import { ForgeMergeRequest } from '../../forges/types/forge-merge-request';
import { ForgeUser } from '../../forges/types/forge-user';
import {
  GithubGraphqlActorNode,
  GithubGraphqlPullRequestNode,
} from '../types/github-pull-request';
import { computeGithubMergeStatus } from './compute-github-merge-status';
import { resolveGithubReviewers } from './resolve-github-reviewers';

/**
 * Maps a GraphQL actor node to the common `ForgeUser` shape (RG-020-07).
 * Only a `User` carries a `name` fragment — every other actor kind (chiefly
 * `Bot`) falls back to its login for both the display name and
 * `remoteUserId`, prefixed `bot:` since bots have no stable `User` id here.
 */
export function mapGraphqlActor(node: GithubGraphqlActorNode): ForgeUser {
  const isUser = node.__typename === 'User';
  return {
    remoteUserId: isUser ? node.login : `bot:${node.login}`,
    username: node.login,
    name: isUser ? (node.name ?? node.login) : node.login,
    avatarUrl: node.avatarUrl,
    webUrl: node.url,
  };
}

/**
 * Maps a raw GraphQL pull request node to the common `ForgeMergeRequest`
 * shape consumed by `MergeRequestsService.upsertForProject` (RG-020-07,
 * RG-019-21) — `mergeStatus` and `reviewers` are computed here, once, from
 * GitHub's raw signals.
 */
export function mapGraphqlPullRequest(
  node: GithubGraphqlPullRequestNode,
): ForgeMergeRequest {
  const author = mapGraphqlActor(node.author);
  const requestedReviewers = (node.reviewRequests?.nodes ?? [])
    .map((request) => request.requestedReviewer)
    .filter(
      (reviewer): reviewer is GithubGraphqlActorNode =>
        reviewer !== null && reviewer.__typename !== 'Team',
    )
    .map(mapGraphqlActor);
  const reviewNodes = node.latestOpinionatedReviews?.nodes ?? [];
  const reviewAuthors = reviewNodes
    .filter((review) => review.author !== null)
    .map((review) => mapGraphqlActor(review.author as GithubGraphqlActorNode));
  // RG-029-01 : dernière revue par utilisateur (latestOpinionatedReviews) à
  // l'état APPROVED. `author` peut être `null` quand le compte GitHub a été
  // supprimé depuis (cf. `should_skip_a_review_whose_author_was_deleted`) —
  // dans ce cas l'approbation compte toujours pour `approved` (comportement
  // préexistant, RG-020-07), mais ne peut pas apparaître dans `approvedBy`
  // faute d'identité à afficher.
  const approvedReviews = reviewNodes.filter(
    (review) => review.state === 'APPROVED',
  );
  const approvers = approvedReviews
    .filter((review) => review.author !== null)
    .map((review) => mapGraphqlActor(review.author as GithubGraphqlActorNode));
  const statusCheckRollupState =
    node.commits.nodes[0]?.commit.statusCheckRollup?.state ?? null;

  return {
    remoteId: node.id,
    iid: node.number,
    title: node.title,
    webUrl: node.url,
    draft: node.isDraft,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    // RG-020-07 : approximation — comments generaux + fils de revue (un fil de 5 messages compte 1, QO-020-01).
    commentsCount: node.comments.totalCount + node.reviewThreads.totalCount,
    // RG-020-07 : indépendant de `reviewDecision` (RG-G07), jamais recalculé depuis les règles du dépôt.
    approved: approvedReviews.length > 0,
    approvedBy: approvers,
    labels: node.labels.nodes.map((label) => label.name),
    changedFiles: node.changedFiles,
    additions: node.additions,
    deletions: node.deletions,
    author,
    reviewers: resolveGithubReviewers(
      requestedReviewers,
      reviewAuthors,
      author.username,
    ),
    assignees: node.assignees.nodes.map(mapGraphqlActor),
    mergeStatus: computeGithubMergeStatus({
      mergeable: node.mergeable,
      mergeStateStatus: node.mergeStateStatus,
      reviewDecision: node.reviewDecision,
      statusCheckRollupState,
    }),
  };
}
