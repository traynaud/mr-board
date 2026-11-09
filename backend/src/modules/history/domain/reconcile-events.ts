import { ForgeMergeRequestEvent } from '../../forges/types/forge-merge-request-event.js';
import {
  HistoryEventType,
  MergeRequestEvent,
} from '../entities/merge-request-event.entity.js';

/** A stored provisional event, reduced to what matching needs. */
export type ProvisionalEvent = Pick<
  MergeRequestEvent,
  'id' | 'type' | 'oldValue' | 'newValue'
>;

export interface EventUpdate {
  id: number;
  occurredAt: string;
  actorUsername: string | null;
  actorName: string | null;
  actorAvatarUrl: string | null;
  sourceEventId: string;
}

export interface ReconciliationResult {
  /** Provisional events confirmed by a forge event (RG-034-04). */
  updates: EventUpdate[];
  /** Forge events with no provisional counterpart, to be created confirmed. */
  inserts: ForgeMergeRequestEvent[];
}

const USER_TYPES_NEW: HistoryEventType[] = [
  'reviewer_added',
  'assignee_added',
  'approved',
];
const USER_TYPES_OLD: HistoryEventType[] = [
  'reviewer_removed',
  'assignee_removed',
  'approval_removed',
];

function parse(value: string | null): unknown {
  if (value === null) {
    return null;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

/**
 * Matching key of RG-034-06: the event type plus its *subject* — the label,
 * or the username for reviewer / assignee / approval changes. Title and
 * draft changes have no subject (GitLab cannot report the title values).
 */
export function matchKey(event: {
  type: HistoryEventType;
  oldValue: string | null;
  newValue: string | null;
}): string {
  if (event.type === 'label_added') {
    return `${event.type}|${String(parse(event.newValue))}`;
  }
  if (event.type === 'label_removed') {
    return `${event.type}|${String(parse(event.oldValue))}`;
  }
  const source = USER_TYPES_NEW.includes(event.type)
    ? event.newValue
    : USER_TYPES_OLD.includes(event.type)
      ? event.oldValue
      : null;
  if (source !== null) {
    const user = parse(source) as { username?: string } | null;
    return `${event.type}|${user?.username ?? ''}`;
  }
  return event.type;
}

/**
 * Confirms provisional events with what the forge reports and creates the
 * rest (RG-034-04, RG-034-06). Forge events already known (by
 * `sourceEventId`) are skipped, which makes a re-run idempotent. A
 * provisional event is matched at most once, oldest first; those left
 * unmatched stay provisional. Comments never match a provisional event.
 */
export function reconcileEvents(
  provisional: ProvisionalEvent[],
  forgeEvents: ForgeMergeRequestEvent[],
  knownSourceIds: ReadonlySet<string>,
): ReconciliationResult {
  const pending = new Map<string, ProvisionalEvent[]>();
  for (const event of [...provisional].sort((a, b) => a.id - b.id)) {
    const key = matchKey(event);
    pending.set(key, [...(pending.get(key) ?? []), event]);
  }

  const updates: EventUpdate[] = [];
  const inserts: ForgeMergeRequestEvent[] = [];

  const ordered = [...forgeEvents].sort((a, b) =>
    a.occurredAt.localeCompare(b.occurredAt),
  );
  for (const forgeEvent of ordered) {
    if (knownSourceIds.has(forgeEvent.sourceEventId)) {
      continue;
    }
    const candidates =
      forgeEvent.type === 'commented'
        ? undefined
        : pending.get(matchKey(forgeEvent));
    const matched = candidates?.shift();
    if (matched) {
      updates.push({
        id: matched.id,
        occurredAt: forgeEvent.occurredAt,
        actorUsername: forgeEvent.actor?.username ?? null,
        actorName: forgeEvent.actor?.name ?? null,
        actorAvatarUrl: forgeEvent.actor?.avatarUrl ?? null,
        sourceEventId: forgeEvent.sourceEventId,
      });
    } else {
      inserts.push(forgeEvent);
    }
  }
  return { updates, inserts };
}
