import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MappedGitlabMergeRequest } from '../gitlab/mappers/map-graphql-merge-request';
import { Project } from '../projects/entities/project.entity';
import { ProjectsService } from '../projects/projects.service';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { resolveReadyAt } from './domain/resolve-ready-at';
import { MergeRequestUserDto } from './dto/merge-request-user.dto';
import { MergeRequestViewDto } from './dto/merge-request-view.dto';
import { MergeRequestAssignee } from './entities/merge-request-assignee.entity';
import { MergeRequestReviewer } from './entities/merge-request-reviewer.entity';
import { MergeRequest } from './entities/merge-request.entity';

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
  ) {}

  /**
   * Open (non-draft) merge requests, sorted by `ready_at` ascending
   * (RG-005-01, RG-G10's Ready block). The `draft: false` filter guarantees
   * `ready_at` is never null for the returned rows (see `resolveReadyAt`).
   */
  async listOpen(): Promise<MergeRequestViewDto[]> {
    const mergeRequests = await this.mergeRequests.find({
      where: { draft: false },
      order: { readyAt: 'ASC' },
    });
    if (mergeRequests.length === 0) {
      return [];
    }

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

    return mergeRequests.map((mr) =>
      toMergeRequestView(
        mr,
        projectsById,
        usersById,
        reviewerIdsByMr.get(mr.id) ?? [],
        assigneeIdsByMr.get(mr.id) ?? [],
      ),
    );
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
): MergeRequestViewDto {
  const project = mustGet(projectsById, mergeRequest.projectId, 'Project');
  const author = mustGet(usersById, mergeRequest.authorId, 'User');
  return {
    id: mergeRequest.id,
    projectAlias: project.alias,
    iid: mergeRequest.iid,
    title: mergeRequest.title,
    webUrl: mergeRequest.webUrl,
    author: toMergeRequestUser(author),
    reviewers: reviewerIds.map((id) =>
      toMergeRequestUser(mustGet(usersById, id, 'User')),
    ),
    assignees: assigneeIds.map((id) =>
      toMergeRequestUser(mustGet(usersById, id, 'User')),
    ),
    approved: mergeRequest.approved,
    commentsCount: mergeRequest.commentsCount,
  };
}
