import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  EntityNotFoundException,
  ForgeAuthException,
  ForgeTimeoutException,
} from '../../common/exceptions';
import { ConnectionsService } from '../connections/connections.service';
import { ForgeClientFactory } from '../forges/forge-client.factory';
import { ForgeMergeRequest } from '../forges/types/forge-merge-request';
import { Project } from '../projects/entities/project.entity';
import { ProjectsService } from '../projects/projects.service';
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
    connectionId: 1,
    remoteProjectId: '42',
    pathWithNamespace: 'equipe/api',
    alias: 'api',
    webUrl: 'https://gitlab.example.com/equipe/api',
    enabled: true,
    color: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

const CONNECTION = {
  id: 1,
  name: 'GitLab',
  type: 'gitlab' as const,
  url: 'https://gitlab.example.com',
};

function mergeRequest(iid: number): ForgeMergeRequest {
  return {
    remoteId: String(iid),
    iid,
    title: `MR ${iid}`,
    webUrl: `https://gitlab.example.com/equipe/api/-/merge_requests/${iid}`,
    draft: false,
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-01T10:00:00Z',
    commentsCount: 0,
    approved: false,
    labels: [],
    changedFiles: 1,
    additions: 1,
    deletions: 0,
    author: {
      remoteUserId: '1',
      username: 'mdupont',
      name: 'Marie Dupont',
      avatarUrl: null,
      webUrl: 'https://gitlab.example.com/mdupont',
    },
    reviewers: [],
    assignees: [],
    mergeStatus: { state: 'mergeable', reasons: [] },
  };
}

interface SyncRunRepoMock {
  create: jest.Mock;
  save: jest.Mock;
  findOne: jest.Mock;
}
interface SettingsServiceMock {
  getRefreshIntervalMin: jest.Mock;
}
interface ConnectionsServiceMock {
  findAll: jest.Mock;
  findOrThrow: jest.Mock;
  getToken: jest.Mock;
}
interface ProjectsServiceMock {
  findById: jest.Mock;
  listActiveByConnection: jest.Mock;
}
interface MergeRequestsServiceMock {
  upsertForProject: jest.Mock;
  deleteMissing: jest.Mock;
}

describe('SyncService', () => {
  let service: SyncService;
  let syncRunsRepo: SyncRunRepoMock;
  let settings: SettingsServiceMock;
  let connections: ConnectionsServiceMock;
  let projects: ProjectsServiceMock;
  let gitlabForge: { fetchOpenMergeRequests: jest.Mock };
  let mergeRequests: MergeRequestsServiceMock;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const savedRuns: Partial<SyncRun>[] = [];
    gitlabForge = { fetchOpenMergeRequests: jest.fn().mockResolvedValue([]) };

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
          useValue: { getRefreshIntervalMin: jest.fn().mockResolvedValue(0) },
        },
        {
          provide: ConnectionsService,
          useValue: {
            findAll: jest.fn().mockResolvedValue([CONNECTION]),
            findOrThrow: jest.fn().mockResolvedValue(CONNECTION),
            getToken: jest.fn().mockResolvedValue('glpat-token'),
          },
        },
        {
          provide: ProjectsService,
          useValue: {
            findById: jest.fn().mockResolvedValue(null),
            listActiveByConnection: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: ForgeClientFactory,
          useValue: { forType: jest.fn().mockReturnValue(gitlabForge) },
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
    connections = module.get(ConnectionsService);
    projects = module.get(ProjectsService);
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
      expect(connections.findAll).not.toHaveBeenCalled();
    });

    it('should_return_running_true_without_waiting_for_the_sync_to_finish', async () => {
      let resolveConnections!: (connections: (typeof CONNECTION)[]) => void;
      connections.findAll.mockReturnValue(
        new Promise((resolve) => {
          resolveConnections = resolve;
        }),
      );

      const result = await service.trigger('manual');

      expect(result).toEqual({ running: true });
      expect(syncRunsRepo.save).not.toHaveBeenCalled();
      resolveConnections([]);
      await flush();
    });

    it('should_not_start_a_second_sync_while_one_is_already_running', async () => {
      let resolveConnections!: (connections: (typeof CONNECTION)[]) => void;
      connections.findAll.mockReturnValue(
        new Promise((resolve) => {
          resolveConnections = resolve;
        }),
      );

      await service.trigger('manual');
      const second = await service.trigger('manual');

      expect(second).toEqual({ running: true });
      expect(connections.findAll).toHaveBeenCalledTimes(1);
      resolveConnections([]);
      await flush();
    });

    it('should_allow_a_new_sync_once_the_previous_one_completed', async () => {
      await service.trigger('manual');
      await flush();

      await service.trigger('manual');
      await flush();

      expect(connections.findAll).toHaveBeenCalledTimes(2);
    });

    it('should_write_an_error_run_without_calling_the_forge_when_the_connection_has_no_token', async () => {
      projects.listActiveByConnection.mockResolvedValue([
        project({ id: 1, alias: 'api' }),
        project({ id: 2, alias: 'web' }),
      ]);
      connections.getToken.mockResolvedValue(null);

      await service.trigger('manual');
      await flush();

      expect(gitlabForge.fetchOpenMergeRequests).not.toHaveBeenCalled();
      expect(syncRunsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          mrCount: 0,
          errorMessage: 'Aucun jeton (GitLab) : api, web',
          trigger: 'manual',
        }),
      );
    });

    it('should_sync_every_active_project_of_every_connection_when_no_project_id_is_given', async () => {
      projects.listActiveByConnection.mockResolvedValue([
        project({ id: 1, alias: 'api' }),
        project({ id: 2, alias: 'web' }),
      ]);
      gitlabForge.fetchOpenMergeRequests
        .mockResolvedValueOnce([mergeRequest(1), mergeRequest(2)])
        .mockResolvedValueOnce([mergeRequest(3)]);
      mergeRequests.upsertForProject
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1);

      await service.trigger('manual');
      await flush();

      expect(mergeRequests.upsertForProject).toHaveBeenNthCalledWith(
        1,
        1,
        1,
        expect.anything(),
        expect.anything(),
      );
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
      gitlabForge.fetchOpenMergeRequests.mockResolvedValue([mergeRequest(1)]);
      mergeRequests.upsertForProject.mockResolvedValue(1);

      await service.trigger('manual', 5);
      await flush();

      expect(projects.listActiveByConnection).not.toHaveBeenCalled();
      expect(gitlabForge.fetchOpenMergeRequests).toHaveBeenCalledWith(
        'https://gitlab.example.com',
        'glpat-token',
        {
          remoteProjectId: '42',
          pathWithNamespace: 'equipe/infra',
          webUrl: 'https://gitlab.example.com/equipe/api',
        },
        expect.anything(),
      );
      const [, , , options] = gitlabForge.fetchOpenMergeRequests.mock
        .calls[0] as [string, string, unknown, { deadlineAt: number }];
      expect(typeof options.deadlineAt).toBe('number');
    });

    it('should_mark_the_run_partial_when_one_project_fails_and_another_succeeds', async () => {
      projects.listActiveByConnection.mockResolvedValue([
        project({ id: 1, alias: 'api' }),
        project({ id: 2, alias: 'infra' }),
      ]);
      gitlabForge.fetchOpenMergeRequests
        .mockResolvedValueOnce([mergeRequest(1)])
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

    it('should_report_a_dedicated_message_when_the_forge_rejects_the_token', async () => {
      projects.listActiveByConnection.mockResolvedValue([
        project({ id: 1, alias: 'api' }),
      ]);
      gitlabForge.fetchOpenMergeRequests.mockRejectedValue(
        new ForgeAuthException(),
      );

      await service.trigger('manual');
      await flush();

      const [saved] = syncRunsRepo.save.mock.calls[0] as [
        { errorMessage: string },
      ];
      expect(saved.errorMessage).toBe('api: Jeton refusé (GitLab)');
    });

    it('should_not_interrupt_other_projects_when_one_times_out', async () => {
      // RG-004-14 : le dépassement du délai par projet (matérialisé ici par
      // ForgeTimeoutException, levée par le client de forge) suit le même
      // chemin générique de gestion d'erreur par projet que les autres
      // échecs (RG-004-07) — vérifié explicitement pour ce cas précis.
      projects.listActiveByConnection.mockResolvedValue([
        project({ id: 1, alias: 'infra' }),
        project({ id: 2, alias: 'api' }),
      ]);
      gitlabForge.fetchOpenMergeRequests
        .mockRejectedValueOnce(new ForgeTimeoutException())
        .mockResolvedValueOnce([mergeRequest(1)]);
      mergeRequests.upsertForProject.mockResolvedValue(1);

      await service.trigger('manual');
      await flush();

      expect(gitlabForge.fetchOpenMergeRequests).toHaveBeenCalledTimes(2);
      expect(mergeRequests.deleteMissing).toHaveBeenCalledTimes(1);
      expect(mergeRequests.deleteMissing).toHaveBeenCalledWith(2, [1]);
      const [saved] = syncRunsRepo.save.mock.calls[0] as [
        { status: string; mrCount: number; errorMessage: string },
      ];
      expect(saved.status).toBe('partial');
      expect(saved.mrCount).toBe(1);
      expect(saved.errorMessage).toContain('infra');
      expect(saved.errorMessage).toContain('Forge request timed out');
    });

    it('should_write_an_error_run_when_an_unexpected_failure_occurs', async () => {
      connections.findAll.mockRejectedValue(new Error('boom'));

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
      let resolveConnections!: (connections: (typeof CONNECTION)[]) => void;
      connections.findAll.mockReturnValue(
        new Promise((resolve) => {
          resolveConnections = resolve;
        }),
      );

      await service.trigger('manual');
      await expect(service.getStatus()).resolves.toEqual(
        expect.objectContaining({ running: true }),
      );

      resolveConnections([]);
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
