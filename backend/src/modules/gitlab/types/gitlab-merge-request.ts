/** Subset of a GitLab GraphQL `User`/`MergeRequest.author` node. */
export interface GitlabGraphqlUserNode {
  /** Global ID, e.g. `gid://gitlab/User/42`. */
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  webUrl: string;
}

/** Subset of a GitLab GraphQL `MergeRequest` node (RG-004-01). */
export interface GitlabGraphqlMergeRequestNode {
  /** Global ID, e.g. `gid://gitlab/MergeRequest/123`. */
  id: string;
  iid: string;
  title: string;
  webUrl: string;
  draft: boolean;
  createdAt: string;
  updatedAt: string;
  userNotesCount: number;
  /**
   * Users who clicked "Approve" (RG-G07, RG-029-01). Deliberately **not**
   * GitLab's `approved` field, which reflects whether the project's approval
   * *rules* are satisfied — true by default with zero approvals on a project
   * with no rule configured — rather than whether anyone actually approved.
   */
  approvedBy: { nodes: GitlabGraphqlUserNode[] };
  labels: { nodes: { title: string }[] };
  diffStatsSummary: {
    fileCount: number;
    additions: number;
    deletions: number;
  } | null;
  author: GitlabGraphqlUserNode;
  reviewers: { nodes: GitlabGraphqlUserNode[] };
  assignees: { nodes: GitlabGraphqlUserNode[] };
  /** Raw GitLab mergeability enum (US-017, RG-017-01). */
  detailedMergeStatus: string;
  conflicts: boolean;
  /** `null` when the merge request has no pipeline yet. */
  headPipeline: { status: string } | null;
  approvalsRequired: number;
  approvalsLeft: number;
  resolvableDiscussionsCount: number;
  resolvedDiscussionsCount: number;
}

export interface GitlabGraphqlMergeRequestsPage {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: GitlabGraphqlMergeRequestNode[];
}

/** Shape of the `project(fullPath).mergeRequests` GraphQL response. */
export interface GitlabGraphqlMergeRequestsResponse {
  data?: {
    project: { mergeRequests: GitlabGraphqlMergeRequestsPage } | null;
  };
  errors?: { message: string }[];
}
