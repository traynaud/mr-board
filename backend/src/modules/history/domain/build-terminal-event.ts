import { ForgeMergeRequestEvent } from '../../forges/types/forge-merge-request-event.js';
import { ForgeMergeRequestState } from '../../forges/types/forge-merge-request-state.js';

/**
 * Turns the state found for a disappeared merge request into its journal
 * event (RG-035-02/03).
 * - `merged` / `closed` → the event, dated by the forge (repli: `requestedAt`),
 *   attributed to whoever merged / closed it;
 * - `null` (404) → `deleted`, actor unknown;
 * - `opened` → `null`: no event, the merge request will come back
 *   (pagination anomaly).
 * The identifier is deterministic, so re-processing never duplicates it.
 */
export function buildTerminalEvent(
  state: ForgeMergeRequestState | null,
  mergeRequest: { mrIid: number; requestedAt: string },
): ForgeMergeRequestEvent | null {
  if (state === null) {
    return {
      sourceEventId: `deleted:${mergeRequest.mrIid}:${mergeRequest.requestedAt}`,
      type: 'deleted',
      occurredAt: mergeRequest.requestedAt,
      actor: null,
      oldValue: JSON.stringify('opened'),
      newValue: null,
    };
  }
  if (state.state === 'opened') {
    return null;
  }
  const occurredAt = state.occurredAt ?? mergeRequest.requestedAt;
  return {
    sourceEventId: `state:${state.state}:${occurredAt}`,
    type: state.state,
    occurredAt,
    actor: state.actor,
    oldValue: JSON.stringify('opened'),
    newValue: JSON.stringify(state.state),
  };
}
