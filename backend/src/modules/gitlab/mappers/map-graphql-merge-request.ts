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
  changedFiles: number;
  additions: number;
  deletions: number;
  author: MappedGitlabUser;
  reviewers: MappedGitlabUser[];
  assignees: MappedGitlabUser[];
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
    changedFiles: node.diffStatsSummary?.fileCount ?? 0,
    additions: node.diffStatsSummary?.additions ?? 0,
    deletions: node.diffStatsSummary?.deletions ?? 0,
    author: mapGraphqlUser(node.author),
    reviewers: node.reviewers.nodes.map(mapGraphqlUser),
    assignees: node.assignees.nodes.map(mapGraphqlUser),
  };
}
