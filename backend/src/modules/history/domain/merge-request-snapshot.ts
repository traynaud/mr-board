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
  /** Author username (stored snapshots and forge payloads; needed for `involvedUsernames`). */
  authorUsername?: string;
  /** When this state was last synchronised (stored snapshots only; US-034 window start). */
  syncedAt?: string;
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
    authorUsername: mergeRequest.author.username,
  };
}

/**
 * JSON `string[]` of the people a merge request concerns: author, reviewers
 * and assignees, without duplicates (US-041). Frozen on every journal event.
 */
export function involvedUsernamesJson(
  snapshot: Pick<
    MergeRequestSnapshot,
    'authorUsername' | 'reviewers' | 'assignees'
  >,
): string {
  const usernames = new Set<string>();
  if (snapshot.authorUsername) {
    usernames.add(snapshot.authorUsername);
  }
  for (const user of [...snapshot.reviewers, ...snapshot.assignees]) {
    usernames.add(user.username);
  }
  return JSON.stringify([...usernames]);
}
