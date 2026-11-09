import type { HistoryEventType } from '../../history/entities/merge-request-event.entity.js';

/** Who performed an action, as reported by the forge. */
export interface ForgeEventActor {
  username: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * Something that really happened on a merge/pull request, as reported by
 * the forge (RG-034-04). `oldValue` / `newValue` use the same JSON encoding
 * as the history journal (RG-033-02).
 */
export interface ForgeMergeRequestEvent {
  /** Stable identifier on the forge, unique per connection (idempotence key). */
  sourceEventId: string;
  type: HistoryEventType;
  occurredAt: string;
  actor: ForgeEventActor | null;
  oldValue: string | null;
  newValue: string | null;
}

/** Bounds of an events fetch (RG-034-04). */
export interface FetchMergeRequestEventsOptions {
  /** Only events at or after this ISO instant are wanted. */
  since: string;
  /** Epoch ms budget for the whole call. */
  deadlineAt: number;
}
