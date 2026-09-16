import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EntityNotFoundException,
  ForgeAuthException,
} from '../../common/exceptions/index.js';
import { ConnectionsService } from '../connections/connections.service.js';
import { Connection } from '../connections/entities/connection.entity.js';
import { ForgeClientFactory } from '../forges/forge-client.factory.js';
import { MergeRequestsService } from '../merge-requests/merge-requests.service.js';
import { Project } from '../projects/entities/project.entity.js';
import { ProjectsService } from '../projects/projects.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { computeNextRunAt } from './domain/compute-next-run-at.js';
import {
  ProjectSyncOutcome,
  summarizeSyncRun,
} from './domain/summarize-sync-run.js';
import { SyncRunDto } from './dto/sync-run.dto.js';
import { SyncStatusResponseDto } from './dto/sync-status-response.dto.js';
import { SyncTriggerResponseDto } from './dto/sync-trigger-response.dto.js';
import { SyncRun, SyncTrigger } from './entities/sync-run.entity.js';

/** Time budget granted to synchronising a single project (ms). See RG-004-14. */
export const PROJECT_SYNC_TIMEOUT_MS = 60_000;

/**
 * Orchestrates the synchronisation of merge requests from every connection
 * (RG-004-05 to RG-004-15, RG-019-16). Holds the "only one sync at a time"
 * lock in memory (single process instance, RG-G16).
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private running = false;

  constructor(
    @InjectRepository(SyncRun)
    private readonly syncRuns: Repository<SyncRun>,
    private readonly settings: SettingsService,
    private readonly connections: ConnectionsService,
    private readonly projects: ProjectsService,
    private readonly forges: ForgeClientFactory,
    private readonly mergeRequests: MergeRequestsService,
  ) {}

  /**
   * Starts a synchronisation in the background and returns immediately
   * (RG-004-05). Never rejects because of a forge failure: those are
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
      const outcomes = await this.syncTargets(projectId);
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

  /**
   * Resolves the targets of this run (RG-019-16) — either every active repo
   * of every connection, or the single repo of `projectId` and its
   * connection — and synchronises them, one connection at a time.
   */
  private async syncTargets(projectId?: number): Promise<ProjectSyncOutcome[]> {
    if (projectId !== undefined) {
      const project = await this.projects.findById(projectId);
      if (!project) {
        return [];
      }
      const connection = await this.connections.findOrThrow(
        project.connectionId,
      );
      return this.syncConnectionProjects(connection, [project]);
    }
    const outcomes: ProjectSyncOutcome[] = [];
    for (const connection of await this.connections.findAll()) {
      // RG-031-03 : résolution d'identité en tâche de fond, y compris pour
      // une connexion sans repo actif — jamais reflétée dans le résumé du
      // run (best-effort, géré par `ConnectionsService.resolveIdentity`).
      // Non attendue et non suivie par le verrou `running` : deux cycles
      // rapprochés peuvent résoudre la même connexion en parallèle, course
      // sans conséquence (écriture idempotente, au pire une valeur légèrement
      // périmée écrasée par la suivante).
      void this.connections.resolveIdentity(connection);
      const projects = await this.projects.listActiveByConnection(
        connection.id,
      );
      outcomes.push(
        ...(await this.syncConnectionProjects(connection, projects)),
      );
    }
    return outcomes;
  }

  /**
   * Synchronises every repo of one connection, sequentially (RG-019-16). A
   * connection without a token never reaches the forge : its repos fail as
   * one aggregated outcome (RG-019-16, RG-019-17).
   */
  private async syncConnectionProjects(
    connection: Connection,
    projects: Project[],
  ): Promise<ProjectSyncOutcome[]> {
    if (projects.length === 0) {
      return [];
    }
    const token = await this.connections.getToken(connection.id);
    if (!token) {
      return [
        {
          projectAlias: '',
          success: false,
          errorMessage: `Aucun jeton (${connection.name}) : ${projects
            .map((project) => project.alias)
            .join(', ')}`,
        },
      ];
    }
    const outcomes: ProjectSyncOutcome[] = [];
    for (const project of projects) {
      outcomes.push(await this.syncProject(connection, project, token));
    }
    return outcomes;
  }

  private async syncProject(
    connection: Connection,
    project: Project,
    token: string,
  ): Promise<ProjectSyncOutcome> {
    try {
      const now = new Date().toISOString();
      const forge = this.forges.forType(connection.type);
      const mergeRequests = await forge.fetchOpenMergeRequests(
        connection.url,
        token,
        {
          remoteProjectId: project.remoteProjectId,
          pathWithNamespace: project.pathWithNamespace,
          webUrl: project.webUrl,
        },
        { deadlineAt: Date.now() + PROJECT_SYNC_TIMEOUT_MS },
      );
      const mrCount = await this.mergeRequests.upsertForProject(
        project.id,
        connection.id,
        mergeRequests,
        now,
      );
      await this.mergeRequests.deleteMissing(
        project.id,
        mergeRequests.map((mr) => mr.iid),
      );
      return { projectAlias: project.alias, success: true, mrCount };
    } catch (error) {
      this.logger.warn(
        `Sync failed for project "${project.alias}": ${describe(error)}`,
      );
      const errorMessage =
        error instanceof ForgeAuthException
          ? `Jeton refusé (${connection.name})`
          : describe(error);
      return { projectAlias: project.alias, success: false, errorMessage };
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
