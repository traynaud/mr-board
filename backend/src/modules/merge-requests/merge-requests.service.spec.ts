import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MappedGitlabMergeRequest } from '../gitlab/mappers/map-graphql-merge-request';
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
  findOneBy: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  createQueryBuilder: jest.Mock;
}
interface AssociationRepoMock {
  delete: jest.Mock;
  insert: jest.Mock;
}

describe('MergeRequestsService', () => {
  let service: MergeRequestsService;
  let mergeRequestsRepo: MergeRequestRepoMock;
  let reviewersRepo: AssociationRepoMock;
  let assigneesRepo: AssociationRepoMock;
  let usersService: { upsert: jest.Mock };
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
          useValue: { delete: jest.fn(), insert: jest.fn() },
        },
        {
          provide: getRepositoryToken(MergeRequestAssignee),
          useValue: { delete: jest.fn(), insert: jest.fn() },
        },
        {
          provide: UsersService,
          useValue: {
            upsert: jest.fn((user: { gitlabUserId: number }) =>
              Promise.resolve({ id: user.gitlabUserId * 10 }),
            ),
          },
        },
      ],
    }).compile();

    service = module.get(MergeRequestsService);
    mergeRequestsRepo = module.get(getRepositoryToken(MergeRequest));
    reviewersRepo = module.get(getRepositoryToken(MergeRequestReviewer));
    assigneesRepo = module.get(getRepositoryToken(MergeRequestAssignee));
    usersService = module.get(UsersService);
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
});
