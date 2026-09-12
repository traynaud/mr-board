import { Entity, PrimaryColumn } from 'typeorm';

/**
 * Association table: a merge request can have several assignees (RG-G06).
 * Fully replaced on every sync of the merge request (RG-004-02).
 */
@Entity({ name: 'merge_request_assignees' })
export class MergeRequestAssignee {
  @PrimaryColumn({ name: 'merge_request_id', type: 'integer' })
  mergeRequestId!: number;

  @PrimaryColumn({ name: 'user_id', type: 'integer' })
  userId!: number;
}
