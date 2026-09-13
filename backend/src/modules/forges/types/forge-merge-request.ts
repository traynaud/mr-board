import { ForgeUser } from './forge-user';
import { MergeStatusResult } from './merge-status';

/**
 * A merge/pull request fetched from a forge, already normalised by the
 * forge's own mapper (RG-004-01, RG-017-01, RG-019-21) — `mergeStatus`
 * included, so `MergeRequestsService` never inspects forge-specific raw
 * signals.
 */
export interface ForgeMergeRequest {
  remoteId: string;
  /** Local number of the merge/pull request on the forge (GitLab IID, GitHub PR number). */
  iid: number;
  title: string;
  webUrl: string;
  draft: boolean;
  author: ForgeUser;
  reviewers: ForgeUser[];
  assignees: ForgeUser[];
  approved: boolean;
  commentsCount: number;
  /** `null` together with `additions`/`deletions` when diff stats are unavailable (RG-006-02). */
  changedFiles: number | null;
  additions: number | null;
  deletions: number | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  mergeStatus: MergeStatusResult;
}
