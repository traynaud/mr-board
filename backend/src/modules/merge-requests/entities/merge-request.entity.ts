import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { MergeStatusState } from '../../forges/types/merge-status';

/**
 * A merge/pull request synchronised locally (RG-004-02). Unique per
 * (`project_id`, `iid`). `ready_at` follows the strict transition table of
 * RG-004-04 and must never be recomputed outside `resolveReadyAt`.
 */
@Entity({ name: 'merge_requests' })
export class MergeRequest {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Text because GitHub exposes string `node_id`s (RG-019-05). */
  @Column({ name: 'remote_id', type: 'text' })
  remoteId!: string;

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
   * Mergeability already normalised by the forge's own mapper at fetch time
   * (RG-017-*, RG-019-21) — never recomputed at read time.
   */
  @Column({ name: 'merge_status_state', type: 'text' })
  mergeStatusState!: MergeStatusState;

  /** JSON-encoded `MergeStatusReason[]`. */
  @Column({ name: 'merge_status_reasons', type: 'text' })
  mergeStatusReasons!: string;
}
