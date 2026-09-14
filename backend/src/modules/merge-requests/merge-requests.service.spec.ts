import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityNotFoundException } from '../../common/exceptions';
import { ConnectionsService } from '../connections/connections.service';
import { FavoritesService } from '../favorites/favorites.service';
import { ForgeMergeRequest } from '../forges/types/forge-merge-request';
import { ProjectsService } from '../projects/projects.service';
import { SettingsService } from '../settings/settings.service';
import { UsersService } from '../users/users.service';
import { DEFAULT_DIFFICULTY_THRESHOLDS } from './domain/calculate-difficulty';
import { DEFAULT_READY_DELAY_THRESHOLDS } from './domain/calculate-ready-delay';
import { EMPTY_COMPOSABLE_FILTERS } from './domain/filter-merge-requests';
import { MergeRequestAssignee } from './entities/merge-request-assignee.entity';
import { MergeRequestReviewer } from './entities/merge-request-reviewer.entity';
import { MergeRequest } from './entities/merge-request.entity';
import { MergeRequestsService } from './merge-requests.service';

const CONNECTION = {
  id: 1,
  name: 'GitLab',
  type: 'gitlab' as const,
  meUsername: null as string | null,
};

function forgeMergeRequest(
  overrides: Partial<ForgeMergeRequest> = {},
): ForgeMergeRequest {
  return {
    remoteId: '123',
    iid: 7,
    title: 'Refonte facturation',
    webUrl: 'https://gitlab.example.com/equipe/api/-/merge_requests/7',
    draft: false,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    commentsCount: 3,
    approved: true,
    labels: ['backend'],
    changedFiles: 12,
    additions: 340,
    deletions: 58,
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
    ...overrides,
  };
}

interface MergeRequestRepoMock {
  find: jest.Mock;
  findOneBy: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  createQueryBuilder: jest.Mock;
}
interface AssociationRepoMock {
  findBy: jest.Mock;
  delete: jest.Mock;
  insert: jest.Mock;
}

describe('MergeRequestsService', () => {
  let service: MergeRequestsService;
  let mergeRequestsRepo: MergeRequestRepoMock;
  let reviewersRepo: AssociationRepoMock;
  let assigneesRepo: AssociationRepoMock;
  let usersService: { upsert: jest.Mock; findByIds: jest.Mock };
  let projectsService: { findByIds: jest.Mock; list: jest.Mock };
  let settingsService: {
    getMeEmail: jest.Mock;
    getThresholds: jest.Mock;
    getIgnoredLabels: jest.Mock;
  };
  let connectionsService: { findAll: jest.Mock };
  let favoritesService: { list: jest.Mock; add: jest.Mock; remove: jest.Mock };
  let queryBuilder: {
    delete: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    execute: jest.Mock;
  };

  beforeEach(async () => {
    queryBuilder = {
      delete: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        MergeRequestsService,
        {
          provide: getRepositoryToken(MergeRequest),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findOneBy: jest.fn().mockResolvedValue(null),
            create: jest.fn(
              (partial: Partial<MergeRequest>) => partial as MergeRequest,
            ),
            save: jest.fn(
              (entity: Partial<MergeRequest>) =>
                Promise.resolve({
                  id: 99,
                  ...entity,
                }) as unknown as MergeRequest,
            ),
            createQueryBuilder: jest.fn(() => queryBuilder),
          },
        },
        {
          provide: getRepositoryToken(MergeRequestReviewer),
          useValue: {
            findBy: jest.fn().mockResolvedValue([]),
            delete: jest.fn(),
            insert: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(MergeRequestAssignee),
          useValue: {
            findBy: jest.fn().mockResolvedValue([]),
            delete: jest.fn(),
            insert: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            upsert: jest.fn(
              (_connectionId: number, user: { remoteUserId: string }) =>
                Promise.resolve({ id: Number(user.remoteUserId) * 10 }),
            ),
            findByIds: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: ProjectsService,
          useValue: {
            findByIds: jest.fn().mockResolvedValue([]),
            list: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: SettingsService,
          useValue: {
            getMeEmail: jest.fn().mockResolvedValue(null),
            getThresholds: jest.fn().mockResolvedValue({
              difficulty: DEFAULT_DIFFICULTY_THRESHOLDS,
              readyDelay: DEFAULT_READY_DELAY_THRESHOLDS,
              workdaysOnly: false,
            }),
            getIgnoredLabels: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: ConnectionsService,
          useValue: {
            findAll: jest.fn().mockResolvedValue([{ ...CONNECTION }]),
          },
        },
        {
          provide: FavoritesService,
          useValue: {
            list: jest.fn().mockResolvedValue([]),
            add: jest.fn().mockResolvedValue(undefined),
            remove: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(MergeRequestsService);
    mergeRequestsRepo = module.get(getRepositoryToken(MergeRequest));
    reviewersRepo = module.get(getRepositoryToken(MergeRequestReviewer));
    assigneesRepo = module.get(getRepositoryToken(MergeRequestAssignee));
    usersService = module.get(UsersService);
    projectsService = module.get(ProjectsService);
    settingsService = module.get(SettingsService);
    connectionsService = module.get(ConnectionsService);
    favoritesService = module.get(FavoritesService);
  });

  function persistedMergeRequest(
    overrides: Partial<MergeRequest> = {},
  ): MergeRequest {
    return {
      id: 1,
      remoteId: '123',
      iid: 7,
      projectId: 1,
      title: 'Refonte facturation',
      webUrl: 'https://gitlab.example.com/equipe/api/-/merge_requests/7',
      draft: false,
      authorId: 10,
      approved: true,
      commentsCount: 3,
      changedFiles: 12,
      additions: 340,
      deletions: 58,
      labels: '[]',
      createdAtGitlab: '2026-09-01T10:00:00.000Z',
      readyAt: '2026-09-01T10:00:00.000Z',
      updatedAtGitlab: '2026-09-01T10:00:00.000Z',
      syncedAt: '2026-09-11T08:00:00.000Z',
      mergeStatusState: 'mergeable',
      mergeStatusReasons: '[]',
      ...overrides,
    };
  }

  /** Default project row used across `listOpen`/`getFacets` tests. */
  const projectRow = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    alias: 'api',
    connectionId: 1,
    ...overrides,
  });

  describe('upsertForProject', () => {
    it('should_insert_a_new_merge_request_with_ready_at_from_gitlab_created_at', async () => {
      const count = await service.upsertForProject(
        1,
        1,
        [forgeMergeRequest()],
        '2026-09-11T08:00:00.000Z',
      );

      expect(count).toBe(1);
      expect(mergeRequestsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 1,
          iid: 7,
          remoteId: '123',
          readyAt: '2026-09-01T10:00:00.000Z',
          labels: JSON.stringify(['backend']),
          syncedAt: '2026-09-11T08:00:00.000Z',
          mergeStatusState: 'mergeable',
          mergeStatusReasons: '[]',
        }),
      );
    });

    it('should_return_null_ready_at_for_a_new_draft_merge_request', async () => {
      await service.upsertForProject(
        1,
        1,
        [forgeMergeRequest({ draft: true })],
        '2026-09-11T08:00:00.000Z',
      );

      expect(mergeRequestsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ readyAt: null }),
      );
    });

    it('should_set_ready_at_to_now_when_an_existing_draft_becomes_non_draft', async () => {
      mergeRequestsRepo.findOneBy.mockResolvedValue({
        id: 55,
        draft: true,
        readyAt: null,
      });

      await service.upsertForProject(
        1,
        1,
        [forgeMergeRequest({ draft: false })],
        '2026-09-11T08:00:00.000Z',
      );

      expect(mergeRequestsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ readyAt: '2026-09-11T08:00:00.000Z' }),
      );
    });

    it('should_keep_ready_at_unchanged_when_an_existing_merge_request_stays_non_draft', async () => {
      mergeRequestsRepo.findOneBy.mockResolvedValue({
        id: 55,
        draft: false,
        readyAt: '2026-09-05T09:00:00.000Z',
      });

      await service.upsertForProject(
        1,
        1,
        [forgeMergeRequest({ draft: false })],
        '2026-09-11T08:00:00.000Z',
      );

      expect(mergeRequestsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ readyAt: '2026-09-05T09:00:00.000Z' }),
      );
    });

    it('should_upsert_each_reviewer_and_assignee_on_the_projects_connection_and_replace_the_association_rows', async () => {
      await service.upsertForProject(
        1,
        7,
        [
          forgeMergeRequest({
            reviewers: [
              {
                remoteUserId: '2',
                username: 'kbenali',
                name: 'Karim Benali',
                avatarUrl: null,
                webUrl: 'https://gitlab.example.com/kbenali',
              },
              {
                remoteUserId: '3',
                username: 'lrousseau',
                name: 'Léa Rousseau',
                avatarUrl: null,
                webUrl: 'https://gitlab.example.com/lrousseau',
              },
            ],
            assignees: [
              {
                remoteUserId: '2',
                username: 'kbenali',
                name: 'Karim Benali',
                avatarUrl: null,
                webUrl: 'https://gitlab.example.com/kbenali',
              },
            ],
          }),
        ],
        '2026-09-11T08:00:00.000Z',
      );

      expect(usersService.upsert).toHaveBeenCalledTimes(4); // author + 2 reviewers + 1 assignee
      expect(usersService.upsert).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ username: 'mdupont' }),
      );
      expect(reviewersRepo.delete).toHaveBeenCalledWith({ mergeRequestId: 99 });
      expect(reviewersRepo.insert).toHaveBeenCalledWith([
        { mergeRequestId: 99, userId: 20 },
        { mergeRequestId: 99, userId: 30 },
      ]);
      expect(assigneesRepo.delete).toHaveBeenCalledWith({ mergeRequestId: 99 });
      expect(assigneesRepo.insert).toHaveBeenCalledWith([
        { mergeRequestId: 99, userId: 20 },
      ]);
    });

    it('should_not_insert_association_rows_when_there_is_no_reviewer_or_assignee', async () => {
      await service.upsertForProject(
        1,
        1,
        [forgeMergeRequest()],
        '2026-09-11T08:00:00.000Z',
      );

      expect(reviewersRepo.delete).toHaveBeenCalledWith({ mergeRequestId: 99 });
      expect(reviewersRepo.insert).not.toHaveBeenCalled();
      expect(assigneesRepo.delete).toHaveBeenCalledWith({ mergeRequestId: 99 });
      expect(assigneesRepo.insert).not.toHaveBeenCalled();
    });
  });

  describe('deleteMissing', () => {
    it('should_delete_every_merge_request_of_the_project_when_no_iid_is_kept', async () => {
      await service.deleteMissing(1, []);

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'project_id = :projectId',
        {
          projectId: 1,
        },
      );
      expect(queryBuilder.andWhere).not.toHaveBeenCalled();
      expect(queryBuilder.execute).toHaveBeenCalled();
    });

    it('should_exclude_kept_iids_from_the_deletion', async () => {
      await service.deleteMissing(1, [7, 8]);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'iid NOT IN (:...keepIids)',
        { keepIids: [7, 8] },
      );
    });
  });

  describe('listOpen', () => {
    const NOW = '2026-09-11T08:00:00.000Z';

    beforeEach(() => {
      jest.useFakeTimers({
        doNotFake: [
          'setTimeout',
          'clearTimeout',
          'setInterval',
          'clearInterval',
          'setImmediate',
          'clearImmediate',
          'nextTick',
          'hrtime',
          'performance',
          'queueMicrotask',
        ],
      });
      jest.setSystemTime(new Date(NOW));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should_return_an_empty_array_and_skip_further_queries_when_there_is_no_open_merge_request', async () => {
      await expect(service.listOpen({})).resolves.toEqual({
        mergeRequests: [],
        warnings: [],
      });

      expect(reviewersRepo.findBy).not.toHaveBeenCalled();
      expect(assigneesRepo.findBy).not.toHaveBeenCalled();
      expect(projectsService.findByIds).not.toHaveBeenCalled();
      expect(usersService.findByIds).not.toHaveBeenCalled();
    });

    it('should_still_warn_about_a_missing_identity_when_there_is_no_open_merge_request', async () => {
      await expect(service.listOpen({ mineOnly: true })).resolves.toEqual({
        mergeRequests: [],
        warnings: ['identity.missing'],
      });
    });

    it('should_query_only_non_draft_merge_requests', async () => {
      mergeRequestsRepo.find.mockResolvedValue([persistedMergeRequest()]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      await service.listOpen({});

      expect(mergeRequestsRepo.find).toHaveBeenCalledWith({
        where: { draft: false },
      });
    });

    it('should_assemble_the_view_with_project_alias_author_and_connection', async () => {
      mergeRequestsRepo.find.mockResolvedValue([persistedMergeRequest()]);
      projectsService.findByIds.mockResolvedValue([
        projectRow({ pathWithNamespace: 'equipe/api' }),
      ]);
      usersService.findByIds.mockResolvedValue([
        {
          id: 10,
          username: 'mdupont',
          name: 'Marie Dupont',
          avatarUrl: 'https://gitlab.example.com/mdupont.png',
        },
      ]);

      const result = await service.listOpen({});

      expect(result).toEqual({
        mergeRequests: [
          {
            id: 1,
            projectAlias: 'api',
            iid: 7,
            title: 'Refonte facturation',
            webUrl: 'https://gitlab.example.com/equipe/api/-/merge_requests/7',
            draft: false,
            labels: [],
            author: {
              username: 'mdupont',
              name: 'Marie Dupont',
              avatarUrl: 'https://gitlab.example.com/mdupont.png',
              isMe: false,
            },
            reviewers: [],
            assignees: [],
            approved: true,
            commentsCount: 3,
            difficulty: 'medium',
            changedFiles: 12,
            additions: 340,
            deletions: 58,
            changedLines: 398,
            createdAt: '2026-09-01T10:00:00.000Z',
            readyAt: '2026-09-01T10:00:00.000Z',
            readyDays: 9,
            readyLevel: 'red',
            openedDays: 9,
            isMine: false,
            isFavorite: false,
            mergeStatus: { state: 'mergeable', reasons: [] },
            connection: { id: 1, name: 'GitLab', type: 'gitlab' },
          },
        ],
        warnings: [],
      });
      expect(projectsService.findByIds).toHaveBeenCalledWith([1]);
      expect(usersService.findByIds).toHaveBeenCalledWith([10]);
    });

    it('should_read_the_merge_status_computed_and_persisted_at_sync_time', async () => {
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({
          mergeStatusState: 'unknown',
          mergeStatusReasons: '[]',
        }),
      ]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const {
        mergeRequests: [view],
      } = await service.listOpen({});

      expect(view.mergeStatus).toEqual({ state: 'unknown', reasons: [] });
    });

    it('should_report_a_blocked_merge_status_with_its_reasons', async () => {
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({
          mergeStatusState: 'blocked',
          mergeStatusReasons: JSON.stringify([{ code: 'conflicts' }]),
        }),
      ]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const {
        mergeRequests: [view],
      } = await service.listOpen({});

      expect(view.mergeStatus).toEqual({
        state: 'blocked',
        reasons: [{ code: 'conflicts' }],
      });
    });

    it('should_compute_changed_lines_and_difficulty_from_the_diff_stats', async () => {
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({
          changedFiles: 34,
          additions: 900,
          deletions: 340,
        }),
      ]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const {
        mergeRequests: [view],
      } = await service.listOpen({});

      expect(view.changedFiles).toBe(34);
      expect(view.additions).toBe(900);
      expect(view.deletions).toBe(340);
      expect(view.changedLines).toBe(1240);
      expect(view.difficulty).toBe('hard');
    });

    it('should_report_medium_difficulty_and_null_stats_when_diff_stats_are_unavailable', async () => {
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({
          changedFiles: null,
          additions: null,
          deletions: null,
        }),
      ]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const {
        mergeRequests: [view],
      } = await service.listOpen({});

      expect(view.difficulty).toBe('medium');
      expect(view.changedFiles).toBeNull();
      expect(view.additions).toBeNull();
      expect(view.deletions).toBeNull();
      expect(view.changedLines).toBeNull();
    });

    it('should_distinguish_a_real_zero_from_unavailable_stats', async () => {
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({ changedFiles: 0, additions: 0, deletions: 0 }),
      ]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const {
        mergeRequests: [view],
      } = await service.listOpen({});

      expect(view.changedFiles).toBe(0);
      expect(view.changedLines).toBe(0);
      expect(view.difficulty).toBe('easy');
    });

    it('should_apply_the_configured_difficulty_thresholds', async () => {
      settingsService.getThresholds.mockResolvedValue({
        difficulty: {
          easyFiles: 10,
          easyLines: 200,
          hardFiles: 30,
          hardLines: 900,
        },
        readyDelay: DEFAULT_READY_DELAY_THRESHOLDS,
        workdaysOnly: false,
      });
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({ changedFiles: 6, additions: 50, deletions: 0 }),
      ]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const {
        mergeRequests: [view],
      } = await service.listOpen({});

      expect(view.difficulty).toBe('easy');
    });

    it('should_group_reviewers_and_assignees_by_merge_request', async () => {
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({ id: 1, authorId: 10 }),
        persistedMergeRequest({ id: 2, iid: 8, authorId: 10 }),
      ]);
      reviewersRepo.findBy.mockResolvedValue([
        { mergeRequestId: 1, userId: 20 },
        { mergeRequestId: 1, userId: 30 },
      ]);
      assigneesRepo.findBy.mockResolvedValue([
        { mergeRequestId: 2, userId: 20 },
      ]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
        { id: 20, username: 'kbenali', name: 'Karim Benali', avatarUrl: null },
        {
          id: 30,
          username: 'lrousseau',
          name: 'Léa Rousseau',
          avatarUrl: null,
        },
      ]);

      const { mergeRequests: result } = await service.listOpen({});

      expect(result[0].reviewers.map((u) => u.username)).toEqual([
        'kbenali',
        'lrousseau',
      ]);
      expect(result[0].assignees).toEqual([]);
      expect(result[1].reviewers).toEqual([]);
      expect(result[1].assignees.map((u) => u.username)).toEqual(['kbenali']);
      expect(usersService.findByIds).toHaveBeenCalledWith(
        expect.arrayContaining([10, 20, 30]),
      );
    });

    it('should_throw_when_a_referenced_project_is_missing', async () => {
      mergeRequestsRepo.find.mockResolvedValue([persistedMergeRequest()]);
      projectsService.findByIds.mockResolvedValue([]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      await expect(service.listOpen({})).rejects.toThrow(/Project 1/);
    });

    it('should_throw_when_a_referenced_connection_is_missing', async () => {
      connectionsService.findAll.mockResolvedValue([]);
      mergeRequestsRepo.find.mockResolvedValue([persistedMergeRequest()]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      await expect(service.listOpen({})).rejects.toThrow(/Connection 1/);
    });

    it('should_throw_when_a_referenced_author_is_missing', async () => {
      mergeRequestsRepo.find.mockResolvedValue([persistedMergeRequest()]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([]);

      await expect(service.listOpen({})).rejects.toThrow(/User 10/);
    });

    it('should_report_a_green_ready_level_for_a_merge_request_ready_since_yesterday', async () => {
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({
          createdAtGitlab: '2026-09-10T08:00:00.000Z',
          readyAt: '2026-09-10T08:00:00.000Z',
        }),
      ]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const {
        mergeRequests: [view],
      } = await service.listOpen({});

      expect(view.readyAt).toBe('2026-09-10T08:00:00.000Z');
      expect(view.readyDays).toBe(1);
      expect(view.readyLevel).toBe('green');
      expect(view.openedDays).toBe(1);
    });

    it('should_report_an_orange_ready_level_for_a_merge_request_ready_three_days_ago', async () => {
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({
          createdAtGitlab: '2026-09-08T08:00:00.000Z',
          readyAt: '2026-09-08T08:00:00.000Z',
        }),
      ]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const {
        mergeRequests: [view],
      } = await service.listOpen({});

      expect(view.readyDays).toBe(3);
      expect(view.readyLevel).toBe('orange');
    });

    it('should_apply_the_configured_ready_delay_thresholds', async () => {
      settingsService.getThresholds.mockResolvedValue({
        difficulty: DEFAULT_DIFFICULTY_THRESHOLDS,
        readyDelay: { greenDays: 5, orangeDays: 10 },
        workdaysOnly: false,
      });
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({
          createdAtGitlab: '2026-09-08T08:00:00.000Z',
          readyAt: '2026-09-08T08:00:00.000Z',
        }),
      ]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const {
        mergeRequests: [view],
      } = await service.listOpen({});

      expect(view.readyDays).toBe(3);
      expect(view.readyLevel).toBe('green');
    });

    it('should_count_only_workdays_when_configured', async () => {
      settingsService.getThresholds.mockResolvedValue({
        difficulty: DEFAULT_DIFFICULTY_THRESHOLDS,
        readyDelay: DEFAULT_READY_DELAY_THRESHOLDS,
        workdaysOnly: true,
      });
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({
          createdAtGitlab: '2026-09-04T08:00:00.000Z',
          readyAt: '2026-09-04T08:00:00.000Z',
        }),
      ]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const {
        mergeRequests: [view],
      } = await service.listOpen({});

      expect(view.readyDays).toBe(5);
    });

    it('should_report_null_ready_fields_and_the_opened_days_for_a_draft', async () => {
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({
          draft: true,
          createdAtGitlab: '2026-08-30T08:00:00.000Z',
          readyAt: null,
        }),
      ]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const {
        mergeRequests: [view],
      } = await service.listOpen({});

      expect(view.draft).toBe(true);
      expect(view.readyAt).toBeNull();
      expect(view.readyDays).toBeNull();
      expect(view.readyLevel).toBeNull();
      expect(view.openedDays).toBe(12);
    });

    it('should_default_to_ready_asc_when_no_sort_is_given', async () => {
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({
          id: 1,
          iid: 1,
          readyAt: '2026-09-05T00:00:00.000Z',
        }),
        persistedMergeRequest({
          id: 2,
          iid: 2,
          readyAt: '2026-09-01T00:00:00.000Z',
        }),
      ]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const { mergeRequests: result } = await service.listOpen({});

      expect(result.map((v) => v.iid)).toEqual([2, 1]);
    });

    it('should_sort_by_difficulty_when_sort_is_diff_asc', async () => {
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({
          id: 1,
          iid: 1,
          changedFiles: 34,
          additions: 900,
          deletions: 340,
        }),
        persistedMergeRequest({
          id: 2,
          iid: 2,
          changedFiles: 1,
          additions: 1,
          deletions: 0,
        }),
      ]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const { mergeRequests: result } = await service.listOpen({
        sort: 'diff:asc',
      });

      expect(result.map((v) => v.difficulty)).toEqual(['easy', 'hard']);
      expect(result.map((v) => v.iid)).toEqual([2, 1]);
    });

    it('should_query_all_merge_requests_when_drafts_is_included', async () => {
      await service.listOpen({ includeDrafts: true });

      expect(mergeRequestsRepo.find).toHaveBeenCalledWith({ where: {} });
    });

    it('should_query_only_non_draft_merge_requests_when_drafts_is_not_included', async () => {
      await service.listOpen({ includeDrafts: false });

      expect(mergeRequestsRepo.find).toHaveBeenCalledWith({
        where: { draft: false },
      });
    });

    it('should_report_is_mine_true_when_my_username_matches_the_author', async () => {
      connectionsService.findAll.mockResolvedValue([
        { ...CONNECTION, meUsername: 'mdupont' },
      ]);
      mergeRequestsRepo.find.mockResolvedValue([persistedMergeRequest()]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const {
        mergeRequests: [view],
      } = await service.listOpen({});

      expect(view.isMine).toBe(true);
    });

    it('should_report_is_me_true_on_the_author_and_false_on_reviewers_and_assignees_who_do_not_match', async () => {
      // RG-023-04/05 : `isMe` is computed per role, independently of `isMine`.
      connectionsService.findAll.mockResolvedValue([
        { ...CONNECTION, meUsername: 'mdupont' },
      ]);
      reviewersRepo.findBy.mockResolvedValue([
        { mergeRequestId: 1, userId: 20 },
      ]);
      assigneesRepo.findBy.mockResolvedValue([
        { mergeRequestId: 1, userId: 30 },
      ]);
      mergeRequestsRepo.find.mockResolvedValue([persistedMergeRequest()]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
        { id: 20, username: 'tgirard', name: 'Thomas Girard', avatarUrl: null },
        { id: 30, username: 'kbenali', name: 'Karim Benali', avatarUrl: null },
      ]);

      const {
        mergeRequests: [view],
      } = await service.listOpen({});

      expect(view.author.isMe).toBe(true);
      expect(view.reviewers[0].isMe).toBe(false);
      expect(view.assignees[0].isMe).toBe(false);
    });

    it('should_report_is_me_true_on_a_reviewer_and_an_assignee_case_insensitively', async () => {
      connectionsService.findAll.mockResolvedValue([
        { ...CONNECTION, meUsername: 'mdupont' },
      ]);
      reviewersRepo.findBy.mockResolvedValue([
        { mergeRequestId: 1, userId: 20 },
      ]);
      assigneesRepo.findBy.mockResolvedValue([
        { mergeRequestId: 1, userId: 20 },
      ]);
      mergeRequestsRepo.find.mockResolvedValue([persistedMergeRequest()]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
        { id: 20, username: 'MDupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const {
        mergeRequests: [view],
      } = await service.listOpen({});

      expect(view.author.isMe).toBe(true);
      expect(view.reviewers[0].isMe).toBe(true);
      expect(view.assignees[0].isMe).toBe(true);
      // Invariant RG-023-05 : isMine is derivable from the per-role isMe fields.
      expect(view.isMine).toBe(true);
    });

    it('should_report_is_me_false_everywhere_when_no_identity_is_configured', async () => {
      mergeRequestsRepo.find.mockResolvedValue([persistedMergeRequest()]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const {
        mergeRequests: [view],
      } = await service.listOpen({});

      expect(view.author.isMe).toBe(false);
      expect(view.isMine).toBe(false);
    });

    it('should_resolve_identity_per_connection_rather_than_globally', async () => {
      // RG-019-25 : « mdupont » est mon identité sur la connexion 1, mais pas
      // sur la connexion 2 — un homonyme n'y déclenche jamais isMe.
      connectionsService.findAll.mockResolvedValue([
        { ...CONNECTION, id: 1, meUsername: 'mdupont' },
        {
          id: 2,
          name: 'gitlab.exemple.fr',
          type: 'gitlab' as const,
          meUsername: null,
        },
      ]);
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({ id: 1, iid: 1, projectId: 1, authorId: 10 }),
        persistedMergeRequest({ id: 2, iid: 2, projectId: 2, authorId: 20 }),
      ]);
      projectsService.findByIds.mockResolvedValue([
        projectRow({ id: 1, connectionId: 1 }),
        projectRow({ id: 2, alias: 'web', connectionId: 2 }),
      ]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
        { id: 20, username: 'mdupont', name: 'Un homonyme', avatarUrl: null },
      ]);

      const { mergeRequests: result } = await service.listOpen({});

      expect(result.find((v) => v.iid === 1)?.author.isMe).toBe(true);
      expect(result.find((v) => v.iid === 2)?.author.isMe).toBe(false);
    });

    it('should_filter_to_merge_requests_where_i_have_a_role_when_mine_only_is_requested', async () => {
      connectionsService.findAll.mockResolvedValue([
        { ...CONNECTION, meUsername: 'mdupont' },
      ]);
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({ id: 1, iid: 1, authorId: 10 }),
        persistedMergeRequest({ id: 2, iid: 2, authorId: 20 }),
      ]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
        { id: 20, username: 'tgirard', name: 'Thomas Girard', avatarUrl: null },
      ]);

      const { mergeRequests: result, warnings } = await service.listOpen({
        mineOnly: true,
      });

      expect(result.map((v) => v.iid)).toEqual([1]);
      expect(warnings).toEqual([]);
    });

    it('should_ignore_mine_only_and_warn_when_no_connection_has_a_username', async () => {
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({ id: 1, iid: 1 }),
        persistedMergeRequest({ id: 2, iid: 2 }),
      ]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const { mergeRequests: result, warnings } = await service.listOpen({
        mineOnly: true,
      });

      expect(result.map((v) => v.iid)).toEqual([1, 2]);
      expect(warnings).toEqual(['identity.missing']);
    });

    it('should_not_warn_when_the_global_email_is_configured_even_without_any_connection_username', async () => {
      settingsService.getMeEmail.mockResolvedValue('marie@exemple.fr');

      await expect(service.listOpen({ mineOnly: true })).resolves.toEqual(
        expect.objectContaining({ warnings: [] }),
      );
    });

    it('should_apply_the_project_composable_filter', async () => {
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({ id: 1, iid: 1, projectId: 1 }),
        persistedMergeRequest({ id: 2, iid: 2, projectId: 2 }),
      ]);
      projectsService.findByIds.mockResolvedValue([
        projectRow(),
        projectRow({ id: 2, alias: 'web' }),
      ]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const { mergeRequests: result } = await service.listOpen({
        filters: { ...EMPTY_COMPOSABLE_FILTERS, project: ['web'] },
      });

      expect(result.map((v) => v.iid)).toEqual([2]);
    });

    it('should_apply_the_connection_composable_filter_case_insensitively', async () => {
      connectionsService.findAll.mockResolvedValue([
        { ...CONNECTION, id: 1, name: 'gitlab.com' },
        { ...CONNECTION, id: 2, name: 'github.com' },
      ]);
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({ id: 1, iid: 1, projectId: 1 }),
        persistedMergeRequest({ id: 2, iid: 2, projectId: 2 }),
      ]);
      projectsService.findByIds.mockResolvedValue([
        projectRow({ connectionId: 1 }),
        projectRow({ id: 2, alias: 'web', connectionId: 2 }),
      ]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const { mergeRequests: result } = await service.listOpen({
        filters: { ...EMPTY_COMPOSABLE_FILTERS, connection: ['GitHub.com'] },
      });

      expect(result.map((v) => v.iid)).toEqual([2]);
    });

    it('should_apply_the_assigned_nobody_composable_filter', async () => {
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({ id: 1, iid: 1 }),
        persistedMergeRequest({ id: 2, iid: 2 }),
      ]);
      reviewersRepo.findBy.mockResolvedValue([
        { mergeRequestId: 1, userId: 10 },
      ]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const { mergeRequests: result } = await service.listOpen({
        filters: { ...EMPTY_COMPOSABLE_FILTERS, assigned: ['nobody'] },
      });

      expect(result.map((v) => v.iid)).toEqual([2]);
    });

    it('should_hide_merge_requests_carrying_an_ignored_label', async () => {
      settingsService.getIgnoredLabels.mockResolvedValue(['wip', 'on-hold']);
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({
          id: 1,
          iid: 1,
          labels: JSON.stringify(['WIP']),
        }),
        persistedMergeRequest({
          id: 2,
          iid: 2,
          labels: JSON.stringify(['on-hold']),
        }),
        persistedMergeRequest({
          id: 3,
          iid: 3,
          labels: JSON.stringify(['backend']),
        }),
      ]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const { mergeRequests: result } = await service.listOpen({});

      expect(result.map((v) => v.iid)).toEqual([3]);
    });

    it('should_not_hide_anything_when_no_label_is_ignored', async () => {
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({
          id: 1,
          iid: 1,
          labels: JSON.stringify(['wip']),
        }),
      ]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const { mergeRequests: result } = await service.listOpen({});

      expect(result.map((v) => v.iid)).toEqual([1]);
    });

    it('should_filter_merge_requests_by_title_search_rg_026', async () => {
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({
          id: 1,
          iid: 1,
          title: 'Refonte de la facturation',
        }),
        persistedMergeRequest({ id: 2, iid: 2, title: 'Correctif export CSV' }),
      ]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const { mergeRequests: result } = await service.listOpen({
        search: 'facturation',
      });

      expect(result.map((v) => v.iid)).toEqual([1]);
    });

    it('should_match_a_merge_request_by_iid_when_the_search_is_a_number_rg_026_05', async () => {
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({
          id: 1,
          iid: 42,
          title: 'Correctif export CSV',
        }),
        persistedMergeRequest({ id: 2, iid: 43, title: 'Autre correctif' }),
      ]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const { mergeRequests: result } = await service.listOpen({
        search: '!42',
      });

      expect(result.map((v) => v.iid)).toEqual([42]);
    });

    it('should_not_filter_anything_for_a_blank_search', async () => {
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({ id: 1, iid: 1 }),
      ]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const { mergeRequests: result } = await service.listOpen({
        search: '   ',
      });

      expect(result.map((v) => v.iid)).toEqual([1]);
    });

    it('should_report_is_favorite_true_when_the_project_and_iid_match_a_favorite_rg_027_04', async () => {
      favoritesService.list.mockResolvedValue([
        { id: 1, projectId: 1, iid: 7, createdAt: '2026-09-01T00:00:00.000Z' },
      ]);
      mergeRequestsRepo.find.mockResolvedValue([persistedMergeRequest()]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const {
        mergeRequests: [view],
      } = await service.listOpen({});

      expect(view.isFavorite).toBe(true);
    });

    it('should_report_is_favorite_false_when_no_favorite_matches', async () => {
      favoritesService.list.mockResolvedValue([
        { id: 1, projectId: 99, iid: 7, createdAt: '2026-09-01T00:00:00.000Z' },
      ]);
      mergeRequestsRepo.find.mockResolvedValue([persistedMergeRequest()]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const {
        mergeRequests: [view],
      } = await service.listOpen({});

      expect(view.isFavorite).toBe(false);
    });

    it('should_filter_to_favorited_merge_requests_when_favorites_only_is_requested_rg_027_10', async () => {
      favoritesService.list.mockResolvedValue([
        { id: 1, projectId: 1, iid: 1, createdAt: '2026-09-01T00:00:00.000Z' },
      ]);
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({ id: 1, iid: 1 }),
        persistedMergeRequest({ id: 2, iid: 2 }),
      ]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const { mergeRequests: result } = await service.listOpen({
        favoritesOnly: true,
      });

      expect(result.map((v) => v.iid)).toEqual([1]);
    });
  });

  describe('getFacets', () => {
    it('should_return_empty_facets_when_there_is_no_open_merge_request', async () => {
      projectsService.list.mockResolvedValue([]);

      await expect(service.getFacets({})).resolves.toEqual({
        connection: [{ value: 'GitLab', label: 'GitLab', count: 0 }],
        project: [],
        author: [],
        assigned: [{ value: 'nobody', label: 'Nobody', count: 0 }],
        approved: [
          { value: 'yes', label: 'Oui', count: 0 },
          { value: 'no', label: 'Non', count: 0 },
        ],
        commented: [
          { value: 'yes', label: 'Oui', count: 0 },
          { value: 'no', label: 'Non', count: 0 },
        ],
        label: [{ value: 'none', label: 'Sans label', count: 0 }],
      });
    });

    it('should_list_every_configured_connection_including_one_with_no_open_merge_request', async () => {
      connectionsService.findAll.mockResolvedValue([
        { ...CONNECTION, id: 1, name: 'gitlab.com' },
        { ...CONNECTION, id: 2, name: 'github.com' },
      ]);
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({ id: 1, projectId: 1 }),
      ]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      projectsService.list.mockResolvedValue([
        { id: 1, alias: 'api', pathWithNamespace: 'equipe/api' },
      ]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const facets = await service.getFacets({});

      expect(facets.connection).toEqual([
        { value: 'github.com', label: 'github.com', count: 0 },
        { value: 'gitlab.com', label: 'gitlab.com', count: 1 },
      ]);
    });

    it('should_list_every_configured_project_including_one_with_no_open_merge_request', async () => {
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({ id: 1, projectId: 1 }),
      ]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      projectsService.list.mockResolvedValue([
        { id: 1, alias: 'api', pathWithNamespace: 'equipe/api' },
        { id: 2, alias: 'web', pathWithNamespace: 'equipe/web' },
      ]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const facets = await service.getFacets({});

      expect(facets.project).toEqual([
        { value: 'api', label: 'api · equipe/api', count: 1 },
        { value: 'web', label: 'web · equipe/web', count: 0 },
      ]);
    });

    it('should_scope_the_base_set_to_drafts_and_mine_before_counting_facets', async () => {
      connectionsService.findAll.mockResolvedValue([
        { ...CONNECTION, meUsername: 'someone-else' },
      ]);
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({ id: 1, authorId: 10 }),
      ]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      projectsService.list.mockResolvedValue([
        { id: 1, alias: 'api', pathWithNamespace: 'equipe/api' },
      ]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const facets = await service.getFacets({ mineOnly: true });

      expect(facets.project).toEqual([
        { value: 'api', label: 'api · equipe/api', count: 0 },
      ]);
    });

    it('should_scope_facet_counts_to_the_search_rg_026_07', async () => {
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({
          id: 1,
          projectId: 1,
          title: 'Refonte facturation',
        }),
        persistedMergeRequest({
          id: 2,
          projectId: 1,
          title: 'Correctif export CSV',
        }),
      ]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      projectsService.list.mockResolvedValue([
        { id: 1, alias: 'api', pathWithNamespace: 'equipe/api' },
      ]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const facets = await service.getFacets({ search: 'facturation' });

      expect(facets.project).toEqual([
        { value: 'api', label: 'api · equipe/api', count: 1 },
      ]);
    });

    it('should_exclude_merge_requests_carrying_an_ignored_label_from_facet_counts', async () => {
      settingsService.getIgnoredLabels.mockResolvedValue(['wip']);
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({ id: 1, labels: JSON.stringify(['wip']) }),
      ]);
      projectsService.findByIds.mockResolvedValue([projectRow()]);
      projectsService.list.mockResolvedValue([
        { id: 1, alias: 'api', pathWithNamespace: 'equipe/api' },
      ]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const facets = await service.getFacets({});

      expect(facets.project).toEqual([
        { value: 'api', label: 'api · equipe/api', count: 0 },
      ]);
    });
  });

  describe('setFavorite', () => {
    it('should_add_the_resolved_project_and_iid_when_marking_favorite_rg_027_04', async () => {
      mergeRequestsRepo.findOneBy.mockResolvedValue(
        persistedMergeRequest({ id: 1, projectId: 3, iid: 42 }),
      );

      await service.setFavorite(1, true);

      expect(mergeRequestsRepo.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(favoritesService.add).toHaveBeenCalledWith(3, 42);
      expect(favoritesService.remove).not.toHaveBeenCalled();
    });

    it('should_remove_the_resolved_project_and_iid_when_unmarking_favorite_rg_027_04', async () => {
      mergeRequestsRepo.findOneBy.mockResolvedValue(
        persistedMergeRequest({ id: 1, projectId: 3, iid: 42 }),
      );

      await service.setFavorite(1, false);

      expect(favoritesService.remove).toHaveBeenCalledWith(3, 42);
      expect(favoritesService.add).not.toHaveBeenCalled();
    });

    it('should_throw_entity_not_found_when_the_merge_request_does_not_exist', async () => {
      mergeRequestsRepo.findOneBy.mockResolvedValue(null);

      await expect(service.setFavorite(999, true)).rejects.toThrow(
        EntityNotFoundException,
      );
      expect(favoritesService.add).not.toHaveBeenCalled();
    });
  });
});
