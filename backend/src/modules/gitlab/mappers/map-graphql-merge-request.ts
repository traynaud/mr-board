import { ForgeMergeRequest } from '../../forges/types/forge-merge-request';
import { ForgeUser } from '../../forges/types/forge-user';
import {
  GitlabGraphqlMergeRequestNode,
  GitlabGraphqlUserNode,
} from '../types/gitlab-merge-request';
import { computeGitlabMergeStatus } from './compute-gitlab-merge-status';

/**
 * Extracts the trailing numeric id from a GitLab GraphQL Global ID
 * (`gid://gitlab/MergeRequest/123` → `123`).
 * @throws Error when `gid` does not end with digits (malformed GitLab response).
 */
export function extractNumericId(gid: string): string {
  const match = /(\d+)$/.exec(gid);
  if (!match) {
    throw new Error(`Unexpected GitLab global id: ${gid}`);
  }
  return match[1];
}

/** Maps a GraphQL user node (author/reviewer/assignee) to the common `ForgeUser` shape. */
export function mapGraphqlUser(node: GitlabGraphqlUserNode): ForgeUser {
  return {
    remoteUserId: extractNumericId(node.id),
    username: node.username,
    name: node.name,
    avatarUrl: node.avatarUrl,
    webUrl: node.webUrl,
  };
}

/**
 * Maps a raw GraphQL merge request node to the common `ForgeMergeRequest`
 * shape consumed by `MergeRequestsService.upsertForProject` (RG-004-01,
 * RG-004-02, RG-019-21) — `mergeStatus` is computed here, once, from
 * GitLab's raw mergeability signals (RG-017-*).
 */
export function mapGraphqlMergeRequest(
  node: GitlabGraphqlMergeRequestNode,
): ForgeMergeRequest {
  return {
    remoteId: extractNumericId(node.id),
    iid: Number(node.iid),
    title: node.title,
    webUrl: node.webUrl,
    draft: node.draft,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    commentsCount: node.userNotesCount,
    // RG-G07 : au moins un approbateur autre que l'auteur — jamais le champ
    // GitLab `approved`, qui reflète les règles d'approbation du projet
    // (vrai par défaut sans règle configurée, même à zéro approbation) et
    // non les approbations réellement données (bug corrigé le 2026-09-14).
    approved: node.approvedBy.nodes.some(
      (user) => extractNumericId(user.id) !== extractNumericId(node.author.id),
    ),
    labels: node.labels.nodes.map((label) => label.title),
    changedFiles: node.diffStatsSummary?.fileCount ?? null,
    additions: node.diffStatsSummary?.additions ?? null,
    deletions: node.diffStatsSummary?.deletions ?? null,
    author: mapGraphqlUser(node.author),
    reviewers: node.reviewers.nodes.map(mapGraphqlUser),
    assignees: node.assignees.nodes.map(mapGraphqlUser),
    mergeStatus: computeGitlabMergeStatus({
      detailedMergeStatus: node.detailedMergeStatus,
      conflicts: node.conflicts,
      headPipelineStatus: node.headPipeline?.status ?? null,
      approvalsLeft: node.approvalsLeft,
      resolvableDiscussionsCount: node.resolvableDiscussionsCount,
      resolvedDiscussionsCount: node.resolvedDiscussionsCount,
    }),
  };
}
