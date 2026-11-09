import { ForgeEventActor } from './forge-merge-request-event.js';

/** Current state of a merge/pull request on the forge (US-035). */
export interface ForgeMergeRequestState {
  state: 'opened' | 'merged' | 'closed';
  /** When it was merged / closed; `null` when the forge does not say. */
  occurredAt: string | null;
  /** Who merged / closed it; `null` when the forge does not say. */
  actor: ForgeEventActor | null;
}

/** Bound of a state fetch. */
export interface FetchMergeRequestStateOptions {
  /** Epoch ms budget for the whole call. */
  deadlineAt: number;
}
