/**
 * Subset of a GitHub GraphQL actor (`User`, `Bot`, `Organization`…) exposing
 * the fields common to author/assignee/reviewer nodes (RG-020-07).
 * `name` is only ever populated for a `User` (the `... on User { name }`
 * fragment) — absent or `null` for every other actor kind, including Bots.
 */
export interface GithubGraphqlActorNode {
  __typename: string;
  login: string;
  avatarUrl: string | null;
  url: string;
  name?: string | null;
}

/** One node of `latestOpinionatedReviews` (RG-020-07/08). `author` is `null` for a deleted account. */
export interface GithubGraphqlReviewNode {
  state: string;
  author: GithubGraphqlActorNode | null;
}

/**
 * One node of `reviewRequests` (RG-020-08). `requestedReviewer` is a `Team`
 * when a whole team was requested — ignored per RG-020-08, recognised by
 * `__typename` alone (a `Team` carries none of the `GithubGraphqlActorNode` fields here).
 */
export interface GithubGraphqlReviewRequestNode {
  requestedReviewer: GithubGraphqlActorNode | { __typename: 'Team' } | null;
}

/** Subset of a GitHub GraphQL `PullRequest` node (RG-020-07). */
export interface GithubGraphqlPullRequestNode {
  id: string;
  number: number;
  title: string;
  url: string;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  comments: { totalCount: number };
  reviewThreads: { totalCount: number };
  latestOpinionatedReviews: { nodes: GithubGraphqlReviewNode[] } | null;
  changedFiles: number;
  additions: number;
  deletions: number;
  labels: { nodes: { name: string }[] };
  author: GithubGraphqlActorNode;
  assignees: { nodes: GithubGraphqlActorNode[] };
  reviewRequests: { nodes: GithubGraphqlReviewRequestNode[] } | null;
  /** Raw GitHub mergeability signals (RG-020-09). */
  mergeable: string;
  mergeStateStatus: string;
  reviewDecision: string | null;
  commits: {
    nodes: { commit: { statusCheckRollup: { state: string } | null } }[];
  };
}

export interface GithubGraphqlPullRequestsPage {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: GithubGraphqlPullRequestNode[];
}

/** Shape of the `repository(owner, name).pullRequests` GraphQL response. */
export interface GithubGraphqlPullRequestsResponse {
  data?: {
    repository: { pullRequests: GithubGraphqlPullRequestsPage } | null;
  } | null;
  /** RG-020-12: a schema error (unsupported GHES field) or a rate-limit error (RG-020-11). */
  errors?: { message: string; type?: string }[];
}
