import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MappedGitlabMergeRequest } from '../gitlab/mappers/map-graphql-merge-request';
import { UsersService } from '../users/users.service';
import { resolveReadyAt } from './domain/resolve-ready-at';
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
  ) {}

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
