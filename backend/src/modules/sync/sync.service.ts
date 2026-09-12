import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EntityNotFoundException } from '../../common/exceptions';
import { mapGraphqlMergeRequest } from '../gitlab/mappers/map-graphql-merge-request';
import { GitlabClientService } from '../gitlab/gitlab-client.service';
import { MergeRequestsService } from '../merge-requests/merge-requests.service';
import { Project } from '../projects/entities/project.entity';
import { ProjectsService } from '../projects/projects.service';
import { SettingsService } from '../settings/settings.service';
import { computeNextRunAt } from './domain/compute-next-run-at';
import {
  ProjectSyncOutcome,
  summarizeSyncRun,
} from './domain/summarize-sync-run';
import { SyncRunDto } from './dto/sync-run.dto';
import { SyncStatusResponseDto } from './dto/sync-status-response.dto';
import { SyncTriggerResponseDto } from './dto/sync-trigger-response.dto';
import { SyncRun, SyncTrigger } from './entities/sync-run.entity';

/** Time budget granted to synchronising a single project (ms). See RG-004-14. */
export const PROJECT_SYNC_TIMEOUT_MS = 60_000;

/**
 * Orchestrates the synchronisation of merge requests from GitLab
 * (RG-004-05 to RG-004-15). Holds the "only one sync at a time" lock in
 * memory (single process instance, RG-G16).
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private running = false;

  constructor(
    @InjectRepository(SyncRun)
    private readonly syncRuns: Repository<SyncRun>,
    private readonly settings: SettingsService,
    private readonly projects: ProjectsService,
    private readonly gitlab: GitlabClientService,
    private readonly mergeRequests: MergeRequestsService,
  ) {}

  /**
   * Starts a synchronisation in the background and returns immediately
   * (RG-004-05). Never rejects because of a GitLab failure: those are
   * captured per project into the resulting `sync_run` instead.
   * @param projectId when given, restricts the sync to this single project.
   * @throws EntityNotFoundException when `projectId` is given but unknown (404).
   */
  async trigger(
    trigger: SyncTrigger,
    projectId?: number,
  ): Promise<SyncTriggerResponseDto> {
    if (projectId !== undefined) {
      const project = await this.projects.findById(projectId);
      if (!project) {
        throw new EntityNotFoundException('Project', projectId);
      }
    }
    if (!this.running) {
      this.running = true;
      void this.run(trigger, projectId).finally(() => {
        this.running = false;
      });
    }
    return { running: true };
  }

  /** `GET /api/v1/sync/status` — current lock state, last run and next due date. */
  async getStatus(): Promise<SyncStatusResponseDto> {
    const lastRun = await this.syncRuns.findOne({
      where: {},
      order: { startedAt: 'DESC' },
    });
    const refreshIntervalMin = await this.settings.getRefreshIntervalMin();
    return {
      running: this.running,
      lastRun: lastRun ? toDto(lastRun) : null,
      nextRunAt: computeNextRunAt(
        refreshIntervalMin,
        lastRun?.startedAt ?? null,
        new Date().toISOString(),
      ),
    };
  }

  private async run(trigger: SyncTrigger, projectId?: number): Promise<void> {
    const startedAt = new Date().toISOString();
    try {
      const token = await this.settings.getToken();
      if (!token) {
        await this.saveRun(startedAt, trigger, {
          status: 'error',
          mrCount: 0,
          errorMessage: 'settings.tokenMissing',
        });
        return;
      }

      const url = await this.settings.getGitlabUrl();
      const targets = await this.resolveTargets(projectId);
      const outcomes: ProjectSyncOutcome[] = [];
      for (const project of targets) {
        outcomes.push(await this.syncProject(project, url, token));
      }

      await this.saveRun(startedAt, trigger, summarizeSyncRun(outcomes));
    } catch (error) {
      this.logger.error(
        `Unexpected synchronisation failure: ${describe(error)}`,
      );
      await this.saveRun(startedAt, trigger, {
        status: 'error',
        mrCount: 0,
        errorMessage: describe(error),
      });
    }
  }

  private async resolveTargets(projectId?: number): Promise<Project[]> {
    if (projectId === undefined) {
      return this.projects.listActive();
    }
    const project = await this.projects.findById(projectId);
    return project ? [project] : [];
  }

  private async syncProject(
    project: Project,
    url: string,
    token: string,
  ): Promise<ProjectSyncOutcome> {
    try {
      const now = new Date().toISOString();
      const nodes = await this.gitlab.getOpenMergeRequests(
        url,
        token,
        project.pathWithNamespace,
        { deadlineAt: Date.now() + PROJECT_SYNC_TIMEOUT_MS },
      );
      const mapped = nodes.map(mapGraphqlMergeRequest);
      const mrCount = await this.mergeRequests.upsertForProject(
        project.id,
        mapped,
        now,
      );
      await this.mergeRequests.deleteMissing(
        project.id,
        mapped.map((mr) => mr.iid),
      );
      return { projectAlias: project.alias, success: true, mrCount };
    } catch (error) {
      this.logger.warn(
        `Sync failed for project "${project.alias}": ${describe(error)}`,
      );
      return {
        projectAlias: project.alias,
        success: false,
        errorMessage: describe(error),
      };
    }
  }

  private async saveRun(
    startedAt: string,
    trigger: SyncTrigger,
    summary: {
      status: SyncRun['status'];
      mrCount: number;
      errorMessage: string | null;
    },
  ): Promise<void> {
    await this.syncRuns.save(
      this.syncRuns.create({
        startedAt,
        finishedAt: new Date().toISOString(),
        status: summary.status,
        mrCount: summary.mrCount,
        errorMessage: summary.errorMessage,
        trigger,
      }),
    );
  }
}

function toDto(run: SyncRun): SyncRunDto {
  return {
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    status: run.status,
    mrCount: run.mrCount,
    errorMessage: run.errorMessage,
    trigger: run.trigger,
  };
}

/** Safe, tokenless description of an error for logs and `sync_runs`. */
function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
