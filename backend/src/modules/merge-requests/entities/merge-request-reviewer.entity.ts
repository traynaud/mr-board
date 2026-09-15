import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Association table: a merge request can have several reviewers (RG-G06).
 * Fully replaced on every sync of the merge request (RG-004-02).
 */
@Entity({ name: 'merge_request_reviewers' })
export class MergeRequestReviewer {
  @PrimaryColumn({ name: 'merge_request_id', type: 'integer' })
  mergeRequestId!: number;

  @PrimaryColumn({ name: 'user_id', type: 'integer' })
  userId!: number;

  /** Insertion order (forge order), since SQLite sorts by primary key otherwise. */
  @Column({ name: 'position', type: 'integer', default: 0 })
  position!: number;
}
