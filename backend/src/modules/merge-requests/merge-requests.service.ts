import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MappedGitlabMergeRequest } from '../gitlab/mappers/map-graphql-merge-request';
import { Project } from '../projects/entities/project.entity';
import { ProjectsService } from '../projects/projects.service';
import { SettingsService } from '../settings/settings.service';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import {
  DEFAULT_DIFFICULTY_THRESHOLDS,
  calculateDifficulty,
} from './domain/calculate-difficulty';
import {
  DEFAULT_READY_DELAY_THRESHOLDS,
  calculateElapsedDays,
  readyLevelForDays,
} from './domain/calculate-ready-delay';
import { Identity, isMine } from './domain/is-mine';
import { resolveReadyAt } from './domain/resolve-ready-at';
import {
  DEFAULT_SORT,
  SortParam,
  sortMergeRequests,
} from './domain/sort-merge-requests';
import { MergeRequestUserDto } from './dto/merge-request-user.dto';
import { MergeRequestViewDto } from './dto/merge-request-view.dto';
import { MergeRequestsResponseDto } from './dto/merge-requests-response.dto';
import { MergeRequestAssignee } from './entities/merge-request-assignee.entity';
import { MergeRequestReviewer } from './entities/merge-request-reviewer.entity';
import { MergeRequest } from './entities/merge-request.entity';

export interface ListOpenOptions {
  sort?: SortParam;
  /** RG-009-01. Defaults to `false` (drafts hidden). */
  includeDrafts?: boolean;
  /** RG-009-02, RG-G09. Defaults to `false`. */
  mineOnly?: boolean;
}

/**
 * Persists merge requests synchronised from GitLab: upsert by
 * (`project_id`, `iid`), `ready_at` computation (RG-004-04), and full
 * replacement of the reviewer/assignee association rows on every sync
 * (RG-004-02).
 */
@Injectable()
export class MergeRequestsService {
  constructor(
    @InjectRepository(MergeRequest)
    private readonly mergeRequests: Repository<MergeRequest>,
    @InjectRepository(MergeRequestReviewer)
    private readonly reviewers: Repository<MergeRequestReviewer>,
    @InjectRepository(MergeRequestAssignee)
    private readonly assignees: Repository<MergeRequestAssignee>,
    private readonly users: UsersService,
    private readonly projects: ProjectsService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Open merge requests, ordered per `sort` (RG-008-01/04, default
   * `ready:asc`). Drafts are excluded unless `includeDrafts` (RG-009-01);
   * when they're excluded, `ready_at` is never null for the returned rows
   * (see `resolveReadyAt`). Sorting happens in memory, once the view
   * fields (`difficulty`, `readyAt`) are assembled, since `diff` ordering
   * depends on a computed value with no SQL equivalent (see archi.md).
   * `mineOnly` restricts to merge requests where I have a role (RG-G09) —
   * silently ignored, with a `warnings` entry, when no identity is
   * configured (RG-009-02).
   */
  async listOpen(
    options: ListOpenOptions = {},
  ): Promise<MergeRequestsResponseDto> {
    const {
      sort = DEFAULT_SORT,
      includeDrafts = false,
      mineOnly = false,
    } = options;
    const mergeRequests = await this.mergeRequests.find({
      where: includeDrafts ? {} : { draft: false },
    });
    const identity = await this.settings.getIdentity();
    const identityMissing =
      identity.username === null && identity.email === null;
    const warnings: string[] =
      mineOnly && identityMissing ? ['identity.missing'] : [];

    if (mergeRequests.length === 0) {
      return { mergeRequests: [], warnings };
    }
    const now = new Date().toISOString();

    const mergeRequestIds = mergeRequests.map((mr) => mr.id);
    const [reviewerRows, assigneeRows] = await Promise.all([
      this.reviewers.findBy({ mergeRequestId: In(mergeRequestIds) }),
      this.assignees.findBy({ mergeRequestId: In(mergeRequestIds) }),
    ]);
    const reviewerIdsByMr = groupUserIds(reviewerRows);
    const assigneeIdsByMr = groupUserIds(assigneeRows);

    const projectIds = [...new Set(mergeRequests.map((mr) => mr.projectId))];
    const userIds = [
      ...new Set([
        ...mergeRequests.map((mr) => mr.authorId),
        ...reviewerRows.map((row) => row.userId),
        ...assigneeRows.map((row) => row.userId),
      ]),
    ];
    const [projectRows, userRows] = await Promise.all([
      this.projects.findByIds(projectIds),
      this.users.findByIds(userIds),
    ]);
    const projectsById = indexById(projectRows);
    const usersById = indexById(userRows);

    let views = mergeRequests.map((mr) =>
      toMergeRequestView(
        mr,
        projectsById,
        usersById,
        reviewerIdsByMr.get(mr.id) ?? [],
        assigneeIdsByMr.get(mr.id) ?? [],
        now,
        identity,
      ),
    );
    if (mineOnly && !identityMissing) {
      views = views.filter((view) => view.isMine);
    }

    return { mergeRequests: sortMergeRequests(views, sort), warnings };
  }

  /**
   * Upserts every merge request of a project synchronisation batch.
   * @param projectId internal id of the project these MRs belong to.
   * @param mergeRequests merge requests mapped from the GitLab GraphQL response.
   * @param syncedAt timestamp of this synchronisation, used both as `synced_at`
   * and, when relevant, as the new `ready_at` (RG-004-04).
   * @returns the number of merge requests processed.
   */
  async upsertForProject(
    projectId: number,
    mergeRequests: MappedGitlabMergeRequest[],
    syncedAt: string,
  ): Promise<number> {
    for (const mergeRequest of mergeRequests) {
      await this.upsertOne(projectId, mergeRequest, syncedAt);
    }
    return mergeRequests.length;
  }

  /**
   * Deletes the merge requests of a project that were not part of the
   * latest GitLab response (RG-004-03). Reviewer/assignee rows cascade.
   * @param keepIids `iid`s returned by GitLab for this project in this sync.
   */
  async deleteMissing(projectId: number, keepIids: number[]): Promise<void> {
    const query = this.mergeRequests
      .createQueryBuilder()
      .delete()
      .where('project_id = :projectId', { projectId });
    if (keepIids.length > 0) {
      query.andWhere('iid NOT IN (:...keepIids)', { keepIids });
    }
    await query.execute();
  }

  private async upsertOne(
    projectId: number,
    mergeRequest: MappedGitlabMergeRequest,
    syncedAt: string,
  ): Promise<void> {
    const author = await this.users.upsert(mergeRequest.author);
    const reviewerUsers = await Promise.all(
      mergeRequest.reviewers.map((reviewer) => this.users.upsert(reviewer)),
    );
    const assigneeUsers = await Promise.all(
      mergeRequest.assignees.map((assignee) => this.users.upsert(assignee)),
    );

    const existing = await this.mergeRequests.findOneBy({
      projectId,
      iid: mergeRequest.iid,
    });
    const readyAt = resolveReadyAt({
      existing: existing
        ? { draft: existing.draft, readyAt: existing.readyAt }
        : null,
      incomingDraft: mergeRequest.draft,
      gitlabCreatedAt: mergeRequest.createdAt,
      now: syncedAt,
    });

    const entity =
      existing ??
      this.mergeRequests.create({ projectId, iid: mergeRequest.iid });
    entity.gitlabMrId = mergeRequest.gitlabMrId;
    entity.title = mergeRequest.title;
    entity.webUrl = mergeRequest.webUrl;
    entity.draft = mergeRequest.draft;
    entity.authorId = author.id;
    entity.approved = mergeRequest.approved;
    entity.commentsCount = mergeRequest.commentsCount;
    entity.changedFiles = mergeRequest.changedFiles;
    entity.additions = mergeRequest.additions;
    entity.deletions = mergeRequest.deletions;
    entity.labels = JSON.stringify(mergeRequest.labels);
    entity.createdAtGitlab = mergeRequest.createdAt;
    entity.readyAt = readyAt;
    entity.updatedAtGitlab = mergeRequest.updatedAt;
    entity.syncedAt = syncedAt;

    const saved = await this.mergeRequests.save(entity);

    await this.replaceAssociations(this.reviewers, saved.id, reviewerUsers);
    await this.replaceAssociations(this.assignees, saved.id, assigneeUsers);
  }

  private async replaceAssociations(
    repository: Repository<MergeRequestReviewer | MergeRequestAssignee>,
    mergeRequestId: number,
    users: { id: number }[],
  ): Promise<void> {
    await repository.delete({ mergeRequestId });
    if (users.length > 0) {
      await repository.insert(
        users.map((user) => ({ mergeRequestId, userId: user.id })),
      );
    }
  }
}

/** Groups association rows (reviewers or assignees) by `mergeRequestId`. */
function groupUserIds(
  rows: { mergeRequestId: number; userId: number }[],
): Map<number, number[]> {
  const grouped = new Map<number, number[]>();
  for (const row of rows) {
    const ids = grouped.get(row.mergeRequestId) ?? [];
    ids.push(row.userId);
    grouped.set(row.mergeRequestId, ids);
  }
  return grouped;
}

function indexById<T extends { id: number }>(rows: T[]): Map<number, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

/**
 * @throws Error when `id` is absent from `byId` — an invariant violation
 * (a foreign key referencing a row that vanished), never a business error.
 */
function mustGet<T>(byId: Map<number, T>, id: number, label: string): T {
  const value = byId.get(id);
  if (!value) {
    throw new Error(
      `${label} ${id} not found while assembling a merge request view`,
    );
  }
  return value;
}

function toMergeRequestUser(user: User): MergeRequestUserDto {
  return {
    username: user.username,
    name: user.name,
    avatarUrl: user.avatarUrl,
  };
}

function toMergeRequestView(
  mergeRequest: MergeRequest,
  projectsById: Map<number, Project>,
  usersById: Map<number, User>,
  reviewerIds: number[],
  assigneeIds: number[],
  now: string,
  identity: Identity,
): MergeRequestViewDto {
  const project = mustGet(projectsById, mergeRequest.projectId, 'Project');
  const author = mustGet(usersById, mergeRequest.authorId, 'User');
  const reviewers = reviewerIds.map((id) =>
    toMergeRequestUser(mustGet(usersById, id, 'User')),
  );
  const assignees = assigneeIds.map((id) =>
    toMergeRequestUser(mustGet(usersById, id, 'User')),
  );
  return {
    id: mergeRequest.id,
    projectAlias: project.alias,
    iid: mergeRequest.iid,
    title: mergeRequest.title,
    webUrl: mergeRequest.webUrl,
    draft: mergeRequest.draft,
    author: toMergeRequestUser(author),
    reviewers,
    assignees,
    approved: mergeRequest.approved,
    commentsCount: mergeRequest.commentsCount,
    ...toDifficultyFields(mergeRequest),
    ...toReadyFields(mergeRequest, now),
    isMine: isMine(
      {
        authorUsername: author.username,
        reviewerUsernames: reviewers.map((reviewer) => reviewer.username),
        assigneeUsernames: assignees.map((assignee) => assignee.username),
      },
      identity,
    ),
  };
}

/**
 * Computes the Ready delay (RG-007-01) or, for a draft, the elapsed time
 * since it was opened (RG-007-05). `workdaysOnly` is hard-coded to `false`
 * until US-014 lets the user configure it.
 */
function toReadyFields(
  mergeRequest: MergeRequest,
  now: string,
): Pick<
  MergeRequestViewDto,
  'createdAt' | 'readyAt' | 'readyDays' | 'readyLevel' | 'openedDays'
> {
  const openedDays = calculateElapsedDays(
    mergeRequest.createdAtGitlab,
    now,
    false,
  );
  if (mergeRequest.readyAt === null) {
    return {
      createdAt: mergeRequest.createdAtGitlab,
      readyAt: null,
      readyDays: null,
      readyLevel: null,
      openedDays,
    };
  }
  const readyDays = calculateElapsedDays(mergeRequest.readyAt, now, false);
  return {
    createdAt: mergeRequest.createdAtGitlab,
    readyAt: mergeRequest.readyAt,
    readyDays,
    readyLevel: readyLevelForDays(readyDays, DEFAULT_READY_DELAY_THRESHOLDS),
    openedDays,
  };
}

/**
 * Computes `difficulty`/`changedLines` and passes through the raw diff
 * stats (RG-006-01, RG-006-05). `changedFiles`, `additions` and
 * `deletions` are always all `null` or all set together (same source,
 * `diffStatsSummary`) — checking `changedFiles` alone is enough.
 */
function toDifficultyFields(
  mergeRequest: MergeRequest,
): Pick<
  MergeRequestViewDto,
  'difficulty' | 'changedFiles' | 'additions' | 'deletions' | 'changedLines'
> {
  const { changedFiles, additions, deletions } = mergeRequest;
  if (changedFiles === null || additions === null || deletions === null) {
    return {
      difficulty: 'medium',
      changedFiles: null,
      additions: null,
      deletions: null,
      changedLines: null,
    };
  }
  const changedLines = additions + deletions;
  return {
    difficulty: calculateDifficulty(
      changedFiles,
      changedLines,
      DEFAULT_DIFFICULTY_THRESHOLDS,
    ),
    changedFiles,
    additions,
    deletions,
    changedLines,
  };
}
