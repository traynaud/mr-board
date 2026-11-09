import { ForgeMergeRequest } from '../../forges/types/forge-merge-request.js';

/** A user as compared by the history: identity is `remoteUserId`. */
export interface SnapshotUser {
  remoteUserId: string;
  username: string;
  name: string;
}

/** The merge request fields watched by the history (RG-033-03). */
export interface MergeRequestSnapshot {
  iid: number;
  title: string;
  webUrl: string;
  draft: boolean;
  labels: string[];
  reviewers: SnapshotUser[];
  assignees: SnapshotUser[];
  approvers: SnapshotUser[];
  commentsCount: number;
}

/** Projects a forge merge request onto the watched fields. */
export function snapshotFromForge(
  mergeRequest: ForgeMergeRequest,
): MergeRequestSnapshot {
  const toUser = (user: {
    remoteUserId: string;
    username: string;
    name: string;
  }): SnapshotUser => ({
    remoteUserId: user.remoteUserId,
    username: user.username,
    name: user.name,
  });
  return {
    iid: mergeRequest.iid,
    title: mergeRequest.title,
    webUrl: mergeRequest.webUrl,
    draft: mergeRequest.draft,
    labels: [...mergeRequest.labels],
    reviewers: mergeRequest.reviewers.map(toUser),
    assignees: mergeRequest.assignees.map(toUser),
    approvers: mergeRequest.approvedBy.map(toUser),
    commentsCount: mergeRequest.commentsCount,
  };
}
