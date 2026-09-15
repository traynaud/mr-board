import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Association table: the users who actually approved the merge request
 * (RG-029-01), exactly those counted by RG-G07's `approved` boolean. Fully
 * replaced on every sync of the merge request (RG-004-02), independent of
 * `MergeRequestReviewer` (an approver may later be removed from reviewers
 * without losing their approval, RG-029-01).
 */
@Entity({ name: 'merge_request_approvers' })
export class MergeRequestApprover {
  @PrimaryColumn({ name: 'merge_request_id', type: 'integer' })
  mergeRequestId!: number;

  @PrimaryColumn({ name: 'user_id', type: 'integer' })
  userId!: number;

  /** Insertion order (forge order), since SQLite sorts by primary key otherwise. */
  @Column({ name: 'position', type: 'integer', default: 0 })
  position!: number;
}
