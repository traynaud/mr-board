import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A GitLab merge request synchronised locally (RG-004-02). Unique per
 * (`project_id`, `iid`). `ready_at` follows the strict transition table of
 * RG-004-04 and must never be recomputed outside `resolveReadyAt`.
 */
@Entity({ name: 'merge_requests' })
export class MergeRequest {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'gitlab_mr_id', type: 'integer' })
  gitlabMrId!: number;

  @Column({ type: 'integer' })
  iid!: number;

  @Column({ name: 'project_id', type: 'integer' })
  projectId!: number;

  @Column({ type: 'text' })
  title!: string;

  @Column({ name: 'web_url', type: 'text' })
  webUrl!: string;

  @Column({ type: 'boolean' })
  draft!: boolean;

  @Column({ name: 'author_id', type: 'integer' })
  authorId!: number;

  @Column({ type: 'boolean' })
  approved!: boolean;

  @Column({ name: 'comments_count', type: 'integer' })
  commentsCount!: number;

  /** `null` when the diff stats were unavailable at sync time (RG-006-02). */
  @Column({ name: 'changed_files', type: 'integer', nullable: true })
  changedFiles!: number | null;

  /** `null` iff `changedFiles` is `null` (same source, `diffStatsSummary`). */
  @Column({ type: 'integer', nullable: true })
  additions!: number | null;

  /** `null` iff `changedFiles` is `null` (same source, `diffStatsSummary`). */
  @Column({ type: 'integer', nullable: true })
  deletions!: number | null;

  /** JSON-encoded `string[]`. */
  @Column({ type: 'text' })
  labels!: string;

  @Column({ name: 'created_at_gitlab', type: 'text' })
  createdAtGitlab!: string;

  /** `null` while the MR is (or has always been) a draft. See RG-004-04. */
  @Column({ name: 'ready_at', type: 'text', nullable: true })
  readyAt!: string | null;

  @Column({ name: 'updated_at_gitlab', type: 'text' })
  updatedAtGitlab!: string;

  @Column({ name: 'synced_at', type: 'text' })
  syncedAt!: string;

  /**
   * Raw GitLab `detailedMergeStatus` enum value (US-017, RG-017-01).
   * `null` for a merge request synced before this US (RG-017-11) — treated
   * as `state: 'unknown'` by `computeMergeStatus`.
   */
  @Column({ name: 'detailed_merge_status', type: 'text', nullable: true })
  detailedMergeStatus!: string | null;

  /** `null` iff `detailedMergeStatus` is `null` (same sync, RG-017-11). */
  @Column({ type: 'boolean', nullable: true })
  conflicts!: boolean | null;

  /** GitLab head pipeline status, `null` when there is no pipeline or no data (RG-017-01). */
  @Column({ name: 'head_pipeline_status', type: 'text', nullable: true })
  headPipelineStatus!: string | null;

  /**
   * Approvals still required by the project's rules. Persisted for
   * information/future use but never read by `computeMergeStatus`
   * (RG-017-04 uses `approvalsLeft` only).
   */
  @Column({ name: 'approvals_required', type: 'integer', nullable: true })
  approvalsRequired!: number | null;

  /** `null` iff `detailedMergeStatus` is `null` (same sync, RG-017-11). */
  @Column({ name: 'approvals_left', type: 'integer', nullable: true })
  approvalsLeft!: number | null;

  /** `null` iff `detailedMergeStatus` is `null` (same sync, RG-017-11). */
  @Column({
    name: 'resolvable_discussions_count',
    type: 'integer',
    nullable: true,
  })
  resolvableDiscussionsCount!: number | null;

  /** `null` iff `detailedMergeStatus` is `null` (same sync, RG-017-11). */
  @Column({
    name: 'resolved_discussions_count',
    type: 'integer',
    nullable: true,
  })
  resolvedDiscussionsCount!: number | null;
}
