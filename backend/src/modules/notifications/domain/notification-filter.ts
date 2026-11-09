import type { HistoryEventType } from '../../history/entities/merge-request-event.entity.js';

/** What decides which events feed the panel (RG-041-01/06). */
export interface NotificationFilter {
  disabledTypes: readonly HistoryEventType[];
  onlyMine: boolean;
  excludeOwn: boolean;
}

/** The event fields the eligibility rule reads. */
export interface NotifiableEvent {
  type: HistoryEventType;
  actorUsername: string | null;
  connectionId: number;
  /** JSON `string[]` frozen at detection time (US-041). */
  mrInvolvedUsernames: string | null;
}

/** My resolved username per connection id (`null` = identity not resolved). */
export type MeByConnection = ReadonlyMap<number, string | null>;

/**
 * Whether an event belongs in the panel (RG-040-01, RG-041-01/03/06), the
 * « seen » state aside. Mirrors the SQL built by `NotificationsService`
 * (a parity test keeps both in step):
 * - a disabled type is hidden;
 * - « exclude my own actions » hides events whose actor is me; an unknown
 *   actor (provisional event) is never excluded;
 * - « only my MRs » keeps events whose merge request concerned me; without a
 *   resolved identity on the event's connection nothing is kept.
 */
export function isEligible(
  event: NotifiableEvent,
  filter: NotificationFilter,
  me: MeByConnection,
): boolean {
  if (filter.disabledTypes.includes(event.type)) {
    return false;
  }
  const username = me.get(event.connectionId)?.toLowerCase() ?? null;
  if (
    filter.excludeOwn &&
    username !== null &&
    event.actorUsername?.toLowerCase() === username
  ) {
    return false;
  }
  if (filter.onlyMine) {
    return (
      username !== null &&
      parseUsernames(event.mrInvolvedUsernames).includes(username)
    );
  }
  return true;
}

/**
 * Token that changes whenever the panel's content changes: a new event, a
 * dismissal, a purge, or a provisional event being confirmed (the number of
 * eligible provisional events drops). Lets the client poll cheaply (RG-040-05).
 */
export function buildRevision(
  maxId: number,
  count: number,
  provisionalCount: number,
): string {
  return `${maxId}:${count}:${provisionalCount}`;
}

function parseUsernames(raw: string | null): string[] {
  if (raw === null) {
    return [];
  }
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? value
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.toLowerCase())
      : [];
  } catch {
    return [];
  }
}
