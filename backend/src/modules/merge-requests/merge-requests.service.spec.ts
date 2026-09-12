import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MappedGitlabMergeRequest } from '../gitlab/mappers/map-graphql-merge-request';
import { ProjectsService } from '../projects/projects.service';
import { UsersService } from '../users/users.service';
import { MergeRequestAssignee } from './entities/merge-request-assignee.entity';
import { MergeRequestReviewer } from './entities/merge-request-reviewer.entity';
import { MergeRequest } from './entities/merge-request.entity';
import { MergeRequestsService } from './merge-requests.service';

function mappedMergeRequest(
  overrides: Partial<MappedGitlabMergeRequest> = {},
): MappedGitlabMergeRequest {
  return {
    gitlabMrId: 123,
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
      gitlabUserId: 1,
      username: 'mdupont',
      name: 'Marie Dupont',
      avatarUrl: null,
      webUrl: 'https://gitlab.example.com/mdupont',
    },
    reviewers: [],
    assignees: [],
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
  let projectsService: { findByIds: jest.Mock };
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
            upsert: jest.fn((user: { gitlabUserId: number }) =>
              Promise.resolve({ id: user.gitlabUserId * 10 }),
            ),
            findByIds: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: ProjectsService,
          useValue: { findByIds: jest.fn().mockResolvedValue([]) },
        },
      ],
    }).compile();

    service = module.get(MergeRequestsService);
    mergeRequestsRepo = module.get(getRepositoryToken(MergeRequest));
    reviewersRepo = module.get(getRepositoryToken(MergeRequestReviewer));
    assigneesRepo = module.get(getRepositoryToken(MergeRequestAssignee));
    usersService = module.get(UsersService);
    projectsService = module.get(ProjectsService);
  });

  describe('upsertForProject', () => {
    it('should_insert_a_new_merge_request_with_ready_at_from_gitlab_created_at', async () => {
      const count = await service.upsertForProject(
        1,
        [mappedMergeRequest()],
        '2026-09-11T08:00:00.000Z',
      );

      expect(count).toBe(1);
      expect(mergeRequestsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 1,
          iid: 7,
          readyAt: '2026-09-01T10:00:00.000Z',
          labels: JSON.stringify(['backend']),
          syncedAt: '2026-09-11T08:00:00.000Z',
        }),
      );
    });

    it('should_return_null_ready_at_for_a_new_draft_merge_request', async () => {
      await service.upsertForProject(
        1,
        [mappedMergeRequest({ draft: true })],
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
        [mappedMergeRequest({ draft: false })],
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
        [mappedMergeRequest({ draft: false })],
        '2026-09-11T08:00:00.000Z',
      );

      expect(mergeRequestsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ readyAt: '2026-09-05T09:00:00.000Z' }),
      );
    });

    it('should_upsert_each_reviewer_and_assignee_and_replace_the_association_rows', async () => {
      await service.upsertForProject(
        1,
        [
          mappedMergeRequest({
            reviewers: [
              {
                gitlabUserId: 2,
                username: 'kbenali',
                name: 'Karim Benali',
                avatarUrl: null,
                webUrl: 'https://gitlab.example.com/kbenali',
              },
              {
                gitlabUserId: 3,
                username: 'lrousseau',
                name: 'Léa Rousseau',
                avatarUrl: null,
                webUrl: 'https://gitlab.example.com/lrousseau',
              },
            ],
            assignees: [
              {
                gitlabUserId: 2,
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
        [mappedMergeRequest()],
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

    function persistedMergeRequest(
      overrides: Partial<MergeRequest> = {},
    ): MergeRequest {
      return {
        id: 1,
        gitlabMrId: 123,
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
        ...overrides,
      };
    }

    it('should_return_an_empty_array_and_skip_further_queries_when_there_is_no_open_merge_request', async () => {
      await expect(service.listOpen()).resolves.toEqual([]);

      expect(reviewersRepo.findBy).not.toHaveBeenCalled();
      expect(assigneesRepo.findBy).not.toHaveBeenCalled();
      expect(projectsService.findByIds).not.toHaveBeenCalled();
      expect(usersService.findByIds).not.toHaveBeenCalled();
    });

    it('should_query_non_draft_merge_requests_sorted_by_ready_at_ascending', async () => {
      mergeRequestsRepo.find.mockResolvedValue([persistedMergeRequest()]);
      projectsService.findByIds.mockResolvedValue([{ id: 1, alias: 'api' }]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      await service.listOpen();

      expect(mergeRequestsRepo.find).toHaveBeenCalledWith({
        where: { draft: false },
        order: { readyAt: 'ASC' },
      });
    });

    it('should_assemble_the_view_with_project_alias_and_author', async () => {
      mergeRequestsRepo.find.mockResolvedValue([persistedMergeRequest()]);
      projectsService.findByIds.mockResolvedValue([
        { id: 1, alias: 'api', pathWithNamespace: 'equipe/api' },
      ]);
      usersService.findByIds.mockResolvedValue([
        {
          id: 10,
          username: 'mdupont',
          name: 'Marie Dupont',
          avatarUrl: 'https://gitlab.example.com/mdupont.png',
        },
      ]);

      const result = await service.listOpen();

      expect(result).toEqual([
        {
          id: 1,
          projectAlias: 'api',
          iid: 7,
          title: 'Refonte facturation',
          webUrl: 'https://gitlab.example.com/equipe/api/-/merge_requests/7',
          draft: false,
          author: {
            username: 'mdupont',
            name: 'Marie Dupont',
            avatarUrl: 'https://gitlab.example.com/mdupont.png',
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
        },
      ]);
      expect(projectsService.findByIds).toHaveBeenCalledWith([1]);
      expect(usersService.findByIds).toHaveBeenCalledWith([10]);
    });

    it('should_compute_changed_lines_and_difficulty_from_the_diff_stats', async () => {
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({
          changedFiles: 34,
          additions: 900,
          deletions: 340,
        }),
      ]);
      projectsService.findByIds.mockResolvedValue([{ id: 1, alias: 'api' }]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const [view] = await service.listOpen();

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
      projectsService.findByIds.mockResolvedValue([{ id: 1, alias: 'api' }]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const [view] = await service.listOpen();

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
      projectsService.findByIds.mockResolvedValue([{ id: 1, alias: 'api' }]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const [view] = await service.listOpen();

      expect(view.changedFiles).toBe(0);
      expect(view.changedLines).toBe(0);
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
      projectsService.findByIds.mockResolvedValue([{ id: 1, alias: 'api' }]);
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

      const result = await service.listOpen();

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

      await expect(service.listOpen()).rejects.toThrow(/Project 1/);
    });

    it('should_throw_when_a_referenced_author_is_missing', async () => {
      mergeRequestsRepo.find.mockResolvedValue([persistedMergeRequest()]);
      projectsService.findByIds.mockResolvedValue([{ id: 1, alias: 'api' }]);
      usersService.findByIds.mockResolvedValue([]);

      await expect(service.listOpen()).rejects.toThrow(/User 10/);
    });

    it('should_report_a_green_ready_level_for_a_merge_request_ready_since_yesterday', async () => {
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({
          createdAtGitlab: '2026-09-10T08:00:00.000Z',
          readyAt: '2026-09-10T08:00:00.000Z',
        }),
      ]);
      projectsService.findByIds.mockResolvedValue([{ id: 1, alias: 'api' }]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const [view] = await service.listOpen();

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
      projectsService.findByIds.mockResolvedValue([{ id: 1, alias: 'api' }]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const [view] = await service.listOpen();

      expect(view.readyDays).toBe(3);
      expect(view.readyLevel).toBe('orange');
    });

    it('should_report_null_ready_fields_and_the_opened_days_for_a_draft', async () => {
      mergeRequestsRepo.find.mockResolvedValue([
        persistedMergeRequest({
          draft: true,
          createdAtGitlab: '2026-08-30T08:00:00.000Z',
          readyAt: null,
        }),
      ]);
      projectsService.findByIds.mockResolvedValue([{ id: 1, alias: 'api' }]);
      usersService.findByIds.mockResolvedValue([
        { id: 10, username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
      ]);

      const [view] = await service.listOpen();

      expect(view.draft).toBe(true);
      expect(view.readyAt).toBeNull();
      expect(view.readyDays).toBeNull();
      expect(view.readyLevel).toBeNull();
      expect(view.openedDays).toBe(12);
    });
  });
});
