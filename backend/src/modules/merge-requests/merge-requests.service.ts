import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EntityNotFoundException } from '../../common/exceptions/index.js';
import { Connection } from '../connections/entities/connection.entity.js';
import { ConnectionsService } from '../connections/connections.service.js';
import { FavoritesService } from '../favorites/favorites.service.js';
import { ForgeMergeRequest } from '../forges/types/forge-merge-request.js';
import { MergeStatusResult } from '../forges/types/merge-status.js';
import { Project } from '../projects/entities/project.entity.js';
import { ProjectsService } from '../projects/projects.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { User } from '../users/entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import {
  DifficultyThresholds,
  calculateDifficulty,
} from './domain/calculate-difficulty.js';
import {
  ReadyDelayThresholds,
  calculateElapsedDays,
  readyLevelForDays,
} from './domain/calculate-ready-delay.js';
import {
  ConfiguredConnection,
  ConfiguredProject,
  buildFacets,
} from './domain/build-facets.js';
import {
  ComposableFilters,
  EMPTY_COMPOSABLE_FILTERS,
  applyComposableFilters,
} from './domain/filter-merge-requests.js';
import { favoriteKey, isFavorite } from './domain/is-favorite.js';
import { isIgnoredByLabel } from './domain/is-ignored-by-label.js';
import { Identity, isMe, isMine } from './domain/is-mine.js';
import {
  compileSearch,
  matchesCompiledSearch,
} from './domain/search-merge-requests.js';
import { resolveReadyAt } from './domain/resolve-ready-at.js';
import {
  DEFAULT_SORT,
  SortParam,
  sortMergeRequests,
} from './domain/sort-merge-requests.js';
import { ConnectionSummaryDto } from './dto/connection-summary.dto.js';
import { MergeRequestUserDto } from './dto/merge-request-user.dto.js';
import { MergeRequestViewDto } from './dto/merge-request-view.dto.js';
import { MergeRequestsFacetsDto } from './dto/merge-requests-facets.dto.js';
import { MergeRequestsResponseDto } from './dto/merge-requests-response.dto.js';
import { MergeRequestApprover } from './entities/merge-request-approver.entity.js';
import { MergeRequestAssignee } from './entities/merge-request-assignee.entity.js';
import { MergeRequestReviewer } from './entities/merge-request-reviewer.entity.js';
import { MergeRequest } from './entities/merge-request.entity.js';

export interface ListOpenOptions {
  sort?: SortParam;
  /** RG-009-01. Defaults to `false` (drafts hidden). */
  includeDrafts?: boolean;
  /** RG-009-02, RG-G09. Defaults to `false`. */
  mineOnly?: boolean;
  /** RG-027-10/11. Defaults to `false`. */
  favoritesOnly?: boolean;
  /** RG-010-01/02. Defaults to no filter active. */
  filters?: ComposableFilters;
  /** RG-026-*. Defaults to `''` (no search, nothing excluded). */
  search?: string;
}

export interface FacetsOptions {
  includeDrafts?: boolean;
  mineOnly?: boolean;
  /** RG-027-10/11. Defaults to `false`. */
  favoritesOnly?: boolean;
  filters?: ComposableFilters;
  /** RG-026-07 : applied before facet counts are computed, never excludable per-facet. */
  search?: string;
}

/**
 * Persists merge requests synchronised from a forge: upsert by
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
    @InjectRepository(MergeRequestApprover)
    private readonly approvers: Repository<MergeRequestApprover>,
    private readonly users: UsersService,
    private readonly projects: ProjectsService,
    private readonly settings: SettingsService,
    private readonly connections: ConnectionsService,
    private readonly favorites: FavoritesService,
  ) {}

  /**
   * Open merge requests, ordered per `sort` (RG-008-01/04, default
   * `ready:asc`), narrowed by the 7 composable filters (RG-010-01/02,
   * RG-021-03) on top of the `drafts`/`mine` base (RG-009). `mineOnly` restricts to
   * merge requests where I have a role (RG-G09) — silently ignored, with a
   * `warnings` entry, when no connection has a username configured
   * (RG-019-09).
   */
  async listOpen(
    options: ListOpenOptions = {},
  ): Promise<MergeRequestsResponseDto> {
    const {
      sort = DEFAULT_SORT,
      includeDrafts = false,
      mineOnly = false,
      favoritesOnly = false,
      filters = EMPTY_COMPOSABLE_FILTERS,
      search = '',
    } = options;
    const { views: base, warnings } = await this.loadBase(
      includeDrafts,
      mineOnly,
      favoritesOnly,
      search,
    );
    const filtered = applyComposableFilters(base, filters);
    return { mergeRequests: sortMergeRequests(filtered, sort), warnings };
  }

  /**
   * Options and contextual counts for the 7 composable filters (RG-010-07,
   * RG-021-03):
   * each filter's own options are counted against the `drafts`/`mine` base
   * with every *other* active composable filter applied, never itself.
   */
  async getFacets(
    options: FacetsOptions = {},
  ): Promise<MergeRequestsFacetsDto> {
    const {
      includeDrafts = false,
      mineOnly = false,
      favoritesOnly = false,
      filters = EMPTY_COMPOSABLE_FILTERS,
      search = '',
    } = options;
    const { views: base } = await this.loadBase(
      includeDrafts,
      mineOnly,
      favoritesOnly,
      search,
    );
    const [configuredProjects, allConnections]: [
      ConfiguredProject[],
      Connection[],
    ] = await Promise.all([this.projects.list(), this.connections.findAll()]);
    const configuredConnections: ConfiguredConnection[] = allConnections.map(
      (connection) => ({ name: connection.name }),
    );
    return buildFacets(
      base,
      filters,
      configuredProjects,
      configuredConnections,
    );
  }

  /**
   * Marks or unmarks a merge request as favorite (RG-027-01/08), identified
   * by its internal id — resolved here to the stable `(projectId, iid)` pair
   * `FavoritesService` actually persists (RG-027-04).
   * @throws EntityNotFoundException if `id` does not match a merge request (404).
   */
  async setFavorite(id: number, favorite: boolean): Promise<void> {
    const mergeRequest = await this.mergeRequests.findOneBy({ id });
    if (!mergeRequest) {
      throw new EntityNotFoundException('MergeRequest', id);
    }
    if (favorite) {
      await this.favorites.add(mergeRequest.projectId, mergeRequest.iid);
    } else {
      await this.favorites.remove(mergeRequest.projectId, mergeRequest.iid);
    }
  }

  /**
   * Assembles the `drafts`/`mine`-scoped merge request views (RG-009),
   * shared by `listOpen` and `getFacets` before the 7 composable filters
   * (RG-010) diverge their outcome (rows vs. facet counts). The
   * `draft: false` filter, when applied, guarantees `ready_at` is never
   * null for the returned rows (see `resolveReadyAt`). Merge requests
   * carrying an ignored label (RG-015-02) or failing the free-text search
   * (RG-026-*) are dropped first, so both `listOpen` and `getFacets` (and
   * their counts) never see them — `search` is therefore always applied,
   * with no per-facet exclusion mechanism (RG-026-07), unlike the 7
   * composable filters.
   *
   * The identity used for `isMe`/`isMine` is resolved per merge request,
   * from the `meUsername` of *its own project's connection* (RG-019-25) —
   * never a single identity for the whole response.
   */
  private async loadBase(
    includeDrafts: boolean,
    mineOnly: boolean,
    favoritesOnly: boolean,
    search = '',
  ): Promise<{ views: MergeRequestViewDto[]; warnings: string[] }> {
    const allMergeRequests = await this.mergeRequests.find({
      where: includeDrafts ? {} : { draft: false },
    });
    const [ignoredLabels, meEmail, allConnections, allFavorites] =
      await Promise.all([
        this.settings.getIgnoredLabels(),
        this.settings.getMeEmail(),
        this.connections.findAll(),
        this.favorites.list(),
      ]);
    const favoriteKeys = new Set(
      allFavorites.map((favorite) => favoriteKey(favorite)),
    );
    // RG-026-* : `search` est normalisée une seule fois (`compileSearch`) et
    // réutilisée pour chaque MR, plutôt que redécoupée/normalisée à chaque
    // appel de `matchesCompiledSearch`.
    const compiledSearch = compileSearch(search);
    const mergeRequests = allMergeRequests
      .filter((mr) => !isIgnoredByLabel(mr.labels, ignoredLabels))
      .filter((mr) => matchesCompiledSearch(mr, compiledSearch));
    const connectionsById = new Map(allConnections.map((c) => [c.id, c]));
    const identityMissing =
      meEmail === null && allConnections.every((c) => c.meUsername === null);
    const warnings: string[] =
      mineOnly && identityMissing ? ['identity.missing'] : [];

    if (mergeRequests.length === 0) {
      return { views: [], warnings };
    }
    const now = new Date().toISOString();
    const thresholds = await this.settings.getThresholds();

    const mergeRequestIds = mergeRequests.map((mr) => mr.id);
    const [reviewerRows, assigneeRows, approverRows] = await Promise.all([
      this.reviewers.find({
        where: { mergeRequestId: In(mergeRequestIds) },
        order: { mergeRequestId: 'ASC', position: 'ASC' },
      }),
      this.assignees.find({
        where: { mergeRequestId: In(mergeRequestIds) },
        order: { mergeRequestId: 'ASC', position: 'ASC' },
      }),
      this.approvers.find({
        where: { mergeRequestId: In(mergeRequestIds) },
        order: { mergeRequestId: 'ASC', position: 'ASC' },
      }),
    ]);
    const reviewerIdsByMr = groupUserIds(reviewerRows);
    const assigneeIdsByMr = groupUserIds(assigneeRows);
    const approverIdsByMr = groupUserIds(approverRows);

    const projectIds = [...new Set(mergeRequests.map((mr) => mr.projectId))];
    const userIds = [
      ...new Set([
        ...mergeRequests.map((mr) => mr.authorId),
        ...reviewerRows.map((row) => row.userId),
        ...assigneeRows.map((row) => row.userId),
        ...approverRows.map((row) => row.userId),
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
        connectionsById,
        meEmail,
        reviewerIdsByMr.get(mr.id) ?? [],
        assigneeIdsByMr.get(mr.id) ?? [],
        approverIdsByMr.get(mr.id) ?? [],
        now,
        thresholds,
        favoriteKeys,
      ),
    );
    if (mineOnly && !identityMissing) {
      views = views.filter((view) => view.isMine);
    }
    if (favoritesOnly) {
      views = views.filter((view) => view.isFavorite);
    }

    return { views, warnings };
  }

  /**
   * Upserts every merge request of a project synchronisation batch.
   * @param projectId internal id of the project these MRs belong to.
   * @param connectionId connection this project belongs to (RG-019-05).
   * @param mergeRequests merge requests mapped from the forge's response.
   * @param syncedAt timestamp of this synchronisation, used both as `synced_at`
   * and, when relevant, as the new `ready_at` (RG-004-04).
   * @returns the number of merge requests processed.
   */
  async upsertForProject(
    projectId: number,
    connectionId: number,
    mergeRequests: ForgeMergeRequest[],
    syncedAt: string,
  ): Promise<number> {
    for (const mergeRequest of mergeRequests) {
      await this.upsertOne(projectId, connectionId, mergeRequest, syncedAt);
    }
    return mergeRequests.length;
  }

  /**
   * Deletes the merge requests of a project that were not part of the
   * latest forge response (RG-004-03). Reviewer/assignee rows cascade.
   * @param keepIids `iid`s returned by the forge for this project in this sync.
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
    connectionId: number,
    mergeRequest: ForgeMergeRequest,
    syncedAt: string,
  ): Promise<void> {
    const author = await this.users.upsert(connectionId, mergeRequest.author);
    const reviewerUsers = await Promise.all(
      mergeRequest.reviewers.map((reviewer) =>
        this.users.upsert(connectionId, reviewer),
      ),
    );
    const assigneeUsers = await Promise.all(
      mergeRequest.assignees.map((assignee) =>
        this.users.upsert(connectionId, assignee),
      ),
    );
    const approverUsers = await Promise.all(
      mergeRequest.approvedBy.map((approver) =>
        this.users.upsert(connectionId, approver),
      ),
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
    entity.remoteId = mergeRequest.remoteId;
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
    entity.mergeStatusState = mergeRequest.mergeStatus.state;
    entity.mergeStatusReasons = JSON.stringify(
      mergeRequest.mergeStatus.reasons,
    );

    const saved = await this.mergeRequests.save(entity);

    await this.replaceAssociations(this.reviewers, saved.id, reviewerUsers);
    await this.replaceAssociations(this.assignees, saved.id, assigneeUsers);
    await this.replaceAssociations(this.approvers, saved.id, approverUsers);
  }

  /**
   * `users` order is preserved as `position` (RG-G06) so it can be restored
   * on read, since SQLite otherwise restitutes rows by primary key order.
   */
  private async replaceAssociations(
    repository: Repository<
      MergeRequestReviewer | MergeRequestAssignee | MergeRequestApprover
    >,
    mergeRequestId: number,
    users: { id: number }[],
  ): Promise<void> {
    await repository.delete({ mergeRequestId });
    if (users.length > 0) {
      await repository.insert(
        users.map((user, position) => ({
          mergeRequestId,
          userId: user.id,
          position,
        })),
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

/**
 * The identity a merge request's `isMe`/`isMine` are resolved against: the
 * `meUsername` of *its own project's connection*, falling back to the global
 * email (RG-019-07, RG-019-25) — never a single identity for the whole
 * response.
 */
function resolveIdentity(
  connectionId: number,
  connectionsById: Map<number, Connection>,
  meEmail: string | null,
): Identity {
  return {
    username: connectionsById.get(connectionId)?.meUsername ?? null,
    email: meEmail,
  };
}

/** @see RG-023-05 : `isMe` is computed independently of the `highlightMe` display preference. */
function toMergeRequestUser(
  user: User,
  identity: Identity,
): MergeRequestUserDto {
  return {
    username: user.username,
    name: user.name,
    avatarUrl: user.avatarUrl,
    isMe: isMe(user.username, identity),
  };
}

function toMergeRequestView(
  mergeRequest: MergeRequest,
  projectsById: Map<number, Project>,
  usersById: Map<number, User>,
  connectionsById: Map<number, Connection>,
  meEmail: string | null,
  reviewerIds: number[],
  assigneeIds: number[],
  approverIds: number[],
  now: string,
  thresholds: {
    difficulty: DifficultyThresholds;
    readyDelay: ReadyDelayThresholds;
    workdaysOnly: boolean;
  },
  favoriteKeys: Set<string>,
): MergeRequestViewDto {
  const project = mustGet(projectsById, mergeRequest.projectId, 'Project');
  const connection = mustGet(
    connectionsById,
    project.connectionId,
    'Connection',
  );
  const identity = resolveIdentity(
    project.connectionId,
    connectionsById,
    meEmail,
  );
  const author = mustGet(usersById, mergeRequest.authorId, 'User');
  const reviewers = reviewerIds.map((id) =>
    toMergeRequestUser(mustGet(usersById, id, 'User'), identity),
  );
  const assignees = assigneeIds.map((id) =>
    toMergeRequestUser(mustGet(usersById, id, 'User'), identity),
  );
  const approvedBy = approverIds.map((id) =>
    toMergeRequestUser(mustGet(usersById, id, 'User'), identity),
  );
  return {
    id: mergeRequest.id,
    projectAlias: project.alias,
    iid: mergeRequest.iid,
    title: mergeRequest.title,
    webUrl: mergeRequest.webUrl,
    draft: mergeRequest.draft,
    labels: JSON.parse(mergeRequest.labels) as string[],
    author: toMergeRequestUser(author, identity),
    reviewers,
    assignees,
    approved: mergeRequest.approved,
    approvedBy,
    commentsCount: mergeRequest.commentsCount,
    ...toDifficultyFields(mergeRequest, thresholds.difficulty),
    ...toReadyFields(
      mergeRequest,
      now,
      thresholds.readyDelay,
      thresholds.workdaysOnly,
    ),
    isMine: isMine(
      {
        authorUsername: author.username,
        reviewerUsernames: reviewers.map((reviewer) => reviewer.username),
        assigneeUsernames: assignees.map((assignee) => assignee.username),
      },
      identity,
    ),
    isFavorite: isFavorite(mergeRequest, favoriteKeys),
    mergeStatus: toMergeStatusField(mergeRequest),
    connection: toConnectionSummary(connection),
  };
}

function toConnectionSummary(connection: Connection): ConnectionSummaryDto {
  return { id: connection.id, name: connection.name, type: connection.type };
}

/**
 * Reads the mergeability already computed and persisted at sync time by the
 * forge's own mapper (RG-017-*, RG-019-21) — never recomputed here.
 */
function toMergeStatusField(
  mergeRequest: MergeRequest,
): MergeRequestViewDto['mergeStatus'] {
  return {
    state: mergeRequest.mergeStatusState,
    reasons: JSON.parse(
      mergeRequest.mergeStatusReasons,
    ) as MergeStatusResult['reasons'],
  };
}

/**
 * Computes the Ready delay (RG-007-01) or, for a draft, the elapsed time
 * since it was opened (RG-007-05), using the user-configured thresholds and
 * `workdaysOnly` option (RG-014-01).
 */
function toReadyFields(
  mergeRequest: MergeRequest,
  now: string,
  thresholds: ReadyDelayThresholds,
  workdaysOnly: boolean,
): Pick<
  MergeRequestViewDto,
  'createdAt' | 'readyAt' | 'readyDays' | 'readyLevel' | 'openedDays'
> {
  const openedDays = calculateElapsedDays(
    mergeRequest.createdAtGitlab,
    now,
    workdaysOnly,
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
  const readyDays = calculateElapsedDays(
    mergeRequest.readyAt,
    now,
    workdaysOnly,
  );
  return {
    createdAt: mergeRequest.createdAtGitlab,
    readyAt: mergeRequest.readyAt,
    readyDays,
    readyLevel: readyLevelForDays(readyDays, thresholds),
    openedDays,
  };
}

/**
 * Computes `difficulty`/`changedLines` and passes through the raw diff
 * stats (RG-006-01, RG-006-05), using the user-configured thresholds
 * (RG-014-01). `changedFiles`, `additions` and `deletions` are always all
 * `null` or all set together (same source, `diffStatsSummary`) — checking
 * `changedFiles` alone is enough.
 */
function toDifficultyFields(
  mergeRequest: MergeRequest,
  thresholds: DifficultyThresholds,
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
    difficulty: calculateDifficulty(changedFiles, changedLines, thresholds),
    changedFiles,
    additions,
    deletions,
    changedLines,
  };
}
