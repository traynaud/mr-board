import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  EntityNotFoundException,
  GitlabTimeoutException,
} from '../../common/exceptions';
import { GitlabGraphqlMergeRequestNode } from '../gitlab/types/gitlab-merge-request';
import { Project } from '../projects/entities/project.entity';
import { ProjectsService } from '../projects/projects.service';
import { GitlabClientService } from '../gitlab/gitlab-client.service';
import { MergeRequestsService } from '../merge-requests/merge-requests.service';
import { SettingsService } from '../settings/settings.service';
import { SyncRun } from './entities/sync-run.entity';
import { SyncService } from './sync.service';

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    gitlabProjectId: 42,
    pathWithNamespace: 'equipe/api',
    alias: 'api',
    webUrl: 'https://gitlab.example.com/equipe/api',
    enabled: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

function rawNode(iid: number): GitlabGraphqlMergeRequestNode {
  return {
    id: `gid://gitlab/MergeRequest/${iid}`,
    iid: String(iid),
    title: `MR ${iid}`,
    webUrl: `https://gitlab.example.com/equipe/api/-/merge_requests/${iid}`,
    draft: false,
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-01T10:00:00Z',
    userNotesCount: 0,
    approved: false,
    labels: { nodes: [] },
    diffStatsSummary: { fileCount: 1, additions: 1, deletions: 0 },
    author: {
      id: 'gid://gitlab/User/1',
      username: 'mdupont',
      name: 'Marie Dupont',
      avatarUrl: null,
      webUrl: 'https://gitlab.example.com/mdupont',
    },
    reviewers: { nodes: [] },
    assignees: { nodes: [] },
  };
}

interface SyncRunRepoMock {
  create: jest.Mock;
  save: jest.Mock;
  findOne: jest.Mock;
}
interface SettingsServiceMock {
  getToken: jest.Mock;
  getGitlabUrl: jest.Mock;
  getRefreshIntervalMin: jest.Mock;
}
interface ProjectsServiceMock {
  findById: jest.Mock;
  listActive: jest.Mock;
}
interface GitlabClientServiceMock {
  getOpenMergeRequests: jest.Mock;
}
interface MergeRequestsServiceMock {
  upsertForProject: jest.Mock;
  deleteMissing: jest.Mock;
}

describe('SyncService', () => {
  let service: SyncService;
  let syncRunsRepo: SyncRunRepoMock;
  let settings: SettingsServiceMock;
  let projects: ProjectsServiceMock;
  let gitlab: GitlabClientServiceMock;
  let mergeRequests: MergeRequestsServiceMock;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const savedRuns: Partial<SyncRun>[] = [];

    const module = await Test.createTestingModule({
      providers: [
        SyncService,
        {
          provide: getRepositoryToken(SyncRun),
          useValue: {
            create: jest.fn((partial: Partial<SyncRun>) => partial),
            save: jest.fn((entity: Partial<SyncRun>) => {
              savedRuns.push(entity);
              return Promise.resolve({ id: savedRuns.length, ...entity });
            }),
            findOne: jest.fn(() => Promise.resolve(null)),
          },
        },
        {
          provide: SettingsService,
          useValue: {
            getToken: jest.fn().mockResolvedValue('glpat-token'),
            getGitlabUrl: jest
              .fn()
              .mockResolvedValue('https://gitlab.example.com'),
            getRefreshIntervalMin: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: ProjectsService,
          useValue: {
            findById: jest.fn().mockResolvedValue(null),
            listActive: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: GitlabClientService,
          useValue: { getOpenMergeRequests: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: MergeRequestsService,
          useValue: {
            upsertForProject: jest.fn().mockResolvedValue(0),
            deleteMissing: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(SyncService);
    syncRunsRepo = module.get(getRepositoryToken(SyncRun));
    settings = module.get(SettingsService);
    projects = module.get(ProjectsService);
    gitlab = module.get(GitlabClientService);
    mergeRequests = module.get(MergeRequestsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('trigger', () => {
    it('should_throw_when_the_given_project_id_is_unknown', async () => {
      projects.findById.mockResolvedValue(null);

      await expect(service.trigger('manual', 99)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
      expect(settings.getToken).not.toHaveBeenCalled();
    });

    it('should_return_running_true_without_waiting_for_the_sync_to_finish', async () => {
      let resolveToken!: (token: string) => void;
      settings.getToken.mockReturnValue(
        new Promise((resolve) => {
          resolveToken = resolve;
        }),
      );

      const result = await service.trigger('manual');

      expect(result).toEqual({ running: true });
      expect(syncRunsRepo.save).not.toHaveBeenCalled();
      resolveToken('glpat-token');
      await flush();
    });

    it('should_not_start_a_second_sync_while_one_is_already_running', async () => {
      let resolveToken!: (token: string) => void;
      settings.getToken.mockReturnValue(
        new Promise((resolve) => {
          resolveToken = resolve;
        }),
      );

      await service.trigger('manual');
      const second = await service.trigger('manual');

      expect(second).toEqual({ running: true });
      expect(settings.getToken).toHaveBeenCalledTimes(1);
      resolveToken('glpat-token');
      await flush();
    });

    it('should_allow_a_new_sync_once_the_previous_one_completed', async () => {
      await service.trigger('manual');
      await flush();

      await service.trigger('manual');
      await flush();

      expect(settings.getToken).toHaveBeenCalledTimes(2);
    });

    it('should_write_an_error_run_without_calling_gitlab_when_no_token_is_configured', async () => {
      settings.getToken.mockResolvedValue(null);

      await service.trigger('manual');
      await flush();

      expect(gitlab.getOpenMergeRequests).not.toHaveBeenCalled();
      expect(syncRunsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          mrCount: 0,
          errorMessage: 'settings.tokenMissing',
          trigger: 'manual',
        }),
      );
    });

    it('should_sync_every_active_project_when_no_project_id_is_given', async () => {
      projects.listActive.mockResolvedValue([
        project({ id: 1, alias: 'api' }),
        project({ id: 2, alias: 'web' }),
      ]);
      gitlab.getOpenMergeRequests
        .mockResolvedValueOnce([rawNode(1), rawNode(2)])
        .mockResolvedValueOnce([rawNode(3)]);
      mergeRequests.upsertForProject
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1);

      await service.trigger('manual');
      await flush();

      expect(mergeRequests.upsertForProject).toHaveBeenCalledTimes(2);
      expect(mergeRequests.deleteMissing).toHaveBeenNthCalledWith(1, 1, [1, 2]);
      expect(mergeRequests.deleteMissing).toHaveBeenNthCalledWith(2, 2, [3]);
      expect(syncRunsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success', mrCount: 3 }),
      );
    });

    it('should_only_sync_the_given_project_when_a_project_id_is_provided', async () => {
      projects.findById.mockResolvedValue(
        project({ id: 5, alias: 'infra', pathWithNamespace: 'equipe/infra' }),
      );
      gitlab.getOpenMergeRequests.mockResolvedValue([rawNode(1)]);
      mergeRequests.upsertForProject.mockResolvedValue(1);

      await service.trigger('manual', 5);
      await flush();

      expect(projects.listActive).not.toHaveBeenCalled();
      expect(gitlab.getOpenMergeRequests).toHaveBeenCalledWith(
        'https://gitlab.example.com',
        'glpat-token',
        'equipe/infra',
        expect.anything(),
      );
      const [, , , options] = gitlab.getOpenMergeRequests.mock.calls[0] as [
        string,
        string,
        string,
        { deadlineAt: number },
      ];
      expect(typeof options.deadlineAt).toBe('number');
    });

    it('should_mark_the_run_partial_when_one_project_fails_and_another_succeeds', async () => {
      projects.listActive.mockResolvedValue([
        project({ id: 1, alias: 'api' }),
        project({ id: 2, alias: 'infra' }),
      ]);
      gitlab.getOpenMergeRequests
        .mockResolvedValueOnce([rawNode(1)])
        .mockRejectedValueOnce(new Error('GitLab is unavailable'));
      mergeRequests.upsertForProject.mockResolvedValue(1);

      await service.trigger('manual');
      await flush();

      expect(mergeRequests.deleteMissing).toHaveBeenCalledTimes(1);
      const [saved] = syncRunsRepo.save.mock.calls[0] as [
        { status: string; mrCount: number; errorMessage: string },
      ];
      expect(saved.status).toBe('partial');
      expect(saved.mrCount).toBe(1);
      expect(saved.errorMessage).toContain('infra');
    });

    it('should_not_interrupt_other_projects_when_one_times_out', async () => {
      // RG-004-14 : le dépassement du délai par projet (matérialisé ici par
      // GitlabTimeoutException, levée par GitlabClientService) suit le même
      // chemin générique de gestion d'erreur par projet que les autres
      // échecs (RG-004-07) — vérifié explicitement pour ce cas précis.
      projects.listActive.mockResolvedValue([
        project({ id: 1, alias: 'infra' }),
        project({ id: 2, alias: 'api' }),
      ]);
      gitlab.getOpenMergeRequests
        .mockRejectedValueOnce(new GitlabTimeoutException())
        .mockResolvedValueOnce([rawNode(1)]);
      mergeRequests.upsertForProject.mockResolvedValue(1);

      await service.trigger('manual');
      await flush();

      expect(gitlab.getOpenMergeRequests).toHaveBeenCalledTimes(2);
      expect(mergeRequests.deleteMissing).toHaveBeenCalledTimes(1);
      expect(mergeRequests.deleteMissing).toHaveBeenCalledWith(2, [1]);
      const [saved] = syncRunsRepo.save.mock.calls[0] as [
        { status: string; mrCount: number; errorMessage: string },
      ];
      expect(saved.status).toBe('partial');
      expect(saved.mrCount).toBe(1);
      expect(saved.errorMessage).toContain('infra');
      expect(saved.errorMessage).toContain('GitLab request timed out');
    });

    it('should_write_an_error_run_when_an_unexpected_failure_occurs', async () => {
      settings.getGitlabUrl.mockRejectedValue(new Error('boom'));

      await service.trigger('manual');
      await flush();

      expect(syncRunsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'error', errorMessage: 'boom' }),
      );
    });
  });

  describe('getStatus', () => {
    it('should_report_not_running_and_no_last_run_initially', async () => {
      await expect(service.getStatus()).resolves.toEqual({
        running: false,
        lastRun: null,
        nextRunAt: null,
      });
    });

    it('should_report_running_true_while_a_sync_is_in_flight', async () => {
      let resolveToken!: (token: string) => void;
      settings.getToken.mockReturnValue(
        new Promise((resolve) => {
          resolveToken = resolve;
        }),
      );

      await service.trigger('manual');
      await expect(service.getStatus()).resolves.toEqual(
        expect.objectContaining({ running: true }),
      );

      resolveToken('glpat-token');
      await flush();
      await expect(service.getStatus()).resolves.toEqual(
        expect.objectContaining({ running: false }),
      );
    });

    it('should_map_the_last_sync_run_to_a_dto', async () => {
      syncRunsRepo.findOne.mockResolvedValue({
        id: 1,
        startedAt: '2026-09-11T08:00:00.000Z',
        finishedAt: '2026-09-11T08:00:05.000Z',
        status: 'success',
        mrCount: 3,
        errorMessage: null,
        trigger: 'manual',
      });

      await expect(service.getStatus()).resolves.toEqual({
        running: false,
        lastRun: {
          startedAt: '2026-09-11T08:00:00.000Z',
          finishedAt: '2026-09-11T08:00:05.000Z',
          status: 'success',
          mrCount: 3,
          errorMessage: null,
          trigger: 'manual',
        },
        nextRunAt: null,
      });
    });

    it('should_compute_the_next_run_from_the_interval_and_the_last_run', async () => {
      settings.getRefreshIntervalMin.mockResolvedValue(15);
      syncRunsRepo.findOne.mockResolvedValue({
        id: 1,
        startedAt: '2026-09-11T08:00:00.000Z',
        finishedAt: '2026-09-11T08:00:05.000Z',
        status: 'success',
        mrCount: 3,
        errorMessage: null,
        trigger: 'manual',
      });

      const result = await service.getStatus();

      expect(result.nextRunAt).toBe('2026-09-11T08:15:00.000Z');
    });

    it('should_be_immediately_due_when_no_sync_ever_ran_and_a_cadence_is_set', async () => {
      settings.getRefreshIntervalMin.mockResolvedValue(5);

      const before = Date.now();
      const result = await service.getStatus();
      const after = Date.now();

      expect(result.nextRunAt).not.toBeNull();
      const nextRunAtTime = new Date(result.nextRunAt as string).getTime();
      expect(nextRunAtTime).toBeGreaterThanOrEqual(before);
      expect(nextRunAtTime).toBeLessThanOrEqual(after);
    });
  });
});
