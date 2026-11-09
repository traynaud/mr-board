import { ForgeEventActor } from '../../forges/types/forge-merge-request-event.js';
import { ForgeMergeRequestState } from '../../forges/types/forge-merge-request-state.js';

interface GithubUserRef {
  login: string;
  avatar_url?: string | null;
}

/** Subset of `GET /repos/{o}/{r}/pulls/{n}`. */
export interface GithubPullDetail {
  state: string;
  merged?: boolean;
  merged_at?: string | null;
  closed_at?: string | null;
  merged_by?: GithubUserRef | null;
}

/** Subset of `GET /repos/{o}/{r}/issues/{n}` (the only place exposing `closed_by`). */
export interface GithubIssueDetail {
  closed_by?: GithubUserRef | null;
}

function toActor(
  user: GithubUserRef | null | undefined,
): ForgeEventActor | null {
  return user
    ? {
        username: user.login,
        name: user.login,
        avatarUrl: user.avatar_url ?? null,
      }
    : null;
}

/** Whether the pull request is closed without having been merged (needs `closed_by`). */
export function isClosedUnmerged(pull: GithubPullDetail): boolean {
  return pull.state === 'closed' && !pull.merged && !pull.merged_at;
}

/**
 * Maps a GitHub pull request onto its terminal state (US-035). `issue` is
 * only consulted for a closed, unmerged pull request, to learn who closed it.
 */
export function mapGithubPullState(
  pull: GithubPullDetail,
  issue: GithubIssueDetail | null,
): ForgeMergeRequestState {
  if (pull.merged || pull.merged_at) {
    return {
      state: 'merged',
      occurredAt: pull.merged_at ?? null,
      actor: toActor(pull.merged_by),
    };
  }
  if (pull.state === 'closed') {
    return {
      state: 'closed',
      occurredAt: pull.closed_at ?? null,
      actor: toActor(issue?.closed_by),
    };
  }
  return { state: 'opened', occurredAt: null, actor: null };
}
