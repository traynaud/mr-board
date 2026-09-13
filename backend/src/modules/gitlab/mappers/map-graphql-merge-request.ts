import {
  GitlabGraphqlMergeRequestNode,
  GitlabGraphqlUserNode,
} from '../types/gitlab-merge-request';

export interface MappedGitlabUser {
  gitlabUserId: number;
  username: string;
  name: string;
  avatarUrl: string | null;
  webUrl: string;
}

export interface MappedGitlabMergeRequest {
  gitlabMrId: number;
  iid: number;
  title: string;
  webUrl: string;
  draft: boolean;
  createdAt: string;
  updatedAt: string;
  commentsCount: number;
  approved: boolean;
  labels: string[];
  /**
   * `null` when GitLab returned no `diffStatsSummary` (RG-006-02) — always
   * `null` together with `additions`/`deletions` (same source).
   */
  changedFiles: number | null;
  additions: number | null;
  deletions: number | null;
  author: MappedGitlabUser;
  reviewers: MappedGitlabUser[];
  assignees: MappedGitlabUser[];
  /** Raw GitLab mergeability data (US-017), consumed by `computeMergeStatus`. */
  detailedMergeStatus: string;
  conflicts: boolean;
  /** `null` when GitLab reports no pipeline for this merge request. */
  headPipelineStatus: string | null;
  approvalsRequired: number;
  approvalsLeft: number;
  resolvableDiscussionsCount: number;
  resolvedDiscussionsCount: number;
}

/**
 * Extracts the trailing numeric id from a GitLab GraphQL Global ID
 * (`gid://gitlab/MergeRequest/123` → `123`).
 * @throws Error when `gid` does not end with digits (malformed GitLab response).
 */
export function extractNumericId(gid: string): number {
  const match = /(\d+)$/.exec(gid);
  if (!match) {
    throw new Error(`Unexpected GitLab global id: ${gid}`);
  }
  return Number(match[1]);
}

/** Maps a GraphQL user node (author/reviewer/assignee) to its internal shape. */
export function mapGraphqlUser(node: GitlabGraphqlUserNode): MappedGitlabUser {
  return {
    gitlabUserId: extractNumericId(node.id),
    username: node.username,
    name: node.name,
    avatarUrl: node.avatarUrl,
    webUrl: node.webUrl,
  };
}

/**
 * Maps a raw GraphQL merge request node to the internal shape consumed by
 * `MergeRequestsService.upsertForProject` (RG-004-01, RG-004-02).
 */
export function mapGraphqlMergeRequest(
  node: GitlabGraphqlMergeRequestNode,
): MappedGitlabMergeRequest {
  return {
    gitlabMrId: extractNumericId(node.id),
    iid: Number(node.iid),
    title: node.title,
    webUrl: node.webUrl,
    draft: node.draft,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    commentsCount: node.userNotesCount,
    approved: node.approved,
    labels: node.labels.nodes.map((label) => label.title),
    changedFiles: node.diffStatsSummary?.fileCount ?? null,
    additions: node.diffStatsSummary?.additions ?? null,
    deletions: node.diffStatsSummary?.deletions ?? null,
    author: mapGraphqlUser(node.author),
    reviewers: node.reviewers.nodes.map(mapGraphqlUser),
    assignees: node.assignees.nodes.map(mapGraphqlUser),
    detailedMergeStatus: node.detailedMergeStatus,
    conflicts: node.conflicts,
    headPipelineStatus: node.headPipeline?.status ?? null,
    approvalsRequired: node.approvalsRequired,
    approvalsLeft: node.approvalsLeft,
    resolvableDiscussionsCount: node.resolvableDiscussionsCount,
    resolvedDiscussionsCount: node.resolvedDiscussionsCount,
  };
}
