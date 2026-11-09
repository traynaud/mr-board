import { ForgeEventActor } from '../../forges/types/forge-merge-request-event.js';
import { ForgeMergeRequestState } from '../../forges/types/forge-merge-request-state.js';

interface GitlabUserRef {
  username: string;
  name: string;
  avatar_url?: string | null;
}

/** Subset of `GET /projects/:id/merge_requests/:iid`. */
export interface GitlabMergeRequestDetail {
  state: string;
  merged_at?: string | null;
  closed_at?: string | null;
  merge_user?: GitlabUserRef | null;
  merged_by?: GitlabUserRef | null;
  closed_by?: GitlabUserRef | null;
}

function toActor(
  user: GitlabUserRef | null | undefined,
): ForgeEventActor | null {
  return user
    ? {
        username: user.username,
        name: user.name,
        avatarUrl: user.avatar_url ?? null,
      }
    : null;
}

/**
 * Maps a GitLab merge request onto its terminal state (US-035). `locked`
 * (being merged) and any unknown value count as still opened: no event is
 * produced until GitLab reports `merged` or `closed`. `merge_user` is read
 * first, the deprecated `merged_by` is the fallback.
 */
export function mapGitlabMergeRequestState(
  detail: GitlabMergeRequestDetail,
): ForgeMergeRequestState {
  if (detail.state === 'merged') {
    return {
      state: 'merged',
      occurredAt: detail.merged_at ?? null,
      actor: toActor(detail.merge_user ?? detail.merged_by),
    };
  }
  if (detail.state === 'closed') {
    return {
      state: 'closed',
      occurredAt: detail.closed_at ?? null,
      actor: toActor(detail.closed_by),
    };
  }
  return { state: 'opened', occurredAt: null, actor: null };
}
