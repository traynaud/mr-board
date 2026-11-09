import { ForgeMergeRequestEvent } from '../../forges/types/forge-merge-request-event.js';
import { matchKey, reconcileEvents } from './reconcile-events.js';

const ALICE = { username: 'alice', name: 'Alice', avatarUrl: null };

function forgeEvent(
  overrides: Partial<ForgeMergeRequestEvent> = {},
): ForgeMergeRequestEvent {
  return {
    sourceEventId: 'note:1',
    type: 'title_changed',
    occurredAt: '2026-11-09T10:00:00Z',
    actor: ALICE,
    oldValue: null,
    newValue: null,
    ...overrides,
  };
}

const user = (username: string, name = username) =>
  JSON.stringify({ username, name });

describe('matchKey', () => {
  it('should_use_the_label_as_subject_for_label_events', () => {
    expect(
      matchKey({ type: 'label_added', oldValue: null, newValue: '"bug"' }),
    ).toBe('label_added|bug');
    expect(
      matchKey({ type: 'label_removed', oldValue: '"bug"', newValue: null }),
    ).toBe('label_removed|bug');
  });

  it('should_use_the_username_as_subject_ignoring_the_display_name', () => {
    const a = matchKey({
      type: 'reviewer_added',
      oldValue: null,
      newValue: user('alice', 'Alice Dupont'),
    });
    const b = matchKey({
      type: 'reviewer_added',
      oldValue: null,
      newValue: user('alice'),
    });
    expect(a).toBe(b);
    expect(a).toBe('reviewer_added|alice');
  });

  it('should_read_the_old_value_for_removals', () => {
    expect(
      matchKey({
        type: 'approval_removed',
        oldValue: user('bob'),
        newValue: null,
      }),
    ).toBe('approval_removed|bob');
  });

  it('should_have_no_subject_for_title_and_draft_changes', () => {
    expect(
      matchKey({ type: 'title_changed', oldValue: '"a"', newValue: '"b"' }),
    ).toBe('title_changed');
    expect(
      matchKey({ type: 'marked_draft', oldValue: 'false', newValue: 'true' }),
    ).toBe('marked_draft');
  });
});

describe('reconcileEvents', () => {
  it('should_confirm_a_provisional_event_with_the_forge_actor_and_date', () => {
    const result = reconcileEvents(
      [{ id: 5, type: 'title_changed', oldValue: '"a"', newValue: '"b"' }],
      [forgeEvent()],
      new Set(),
    );

    expect(result.inserts).toEqual([]);
    expect(result.updates).toEqual([
      {
        id: 5,
        occurredAt: '2026-11-09T10:00:00Z',
        actorUsername: 'alice',
        actorName: 'Alice',
        actorAvatarUrl: null,
        sourceEventId: 'note:1',
      },
    ]);
  });

  it('should_insert_a_forge_event_without_provisional_counterpart', () => {
    const event = forgeEvent({
      type: 'approved',
      newValue: user('bob'),
    });

    const result = reconcileEvents([], [event], new Set());

    expect(result).toEqual({ updates: [], inserts: [event] });
  });

  it('should_match_each_provisional_event_at_most_once_oldest_first', () => {
    const provisional = [
      { id: 2, type: 'label_added' as const, oldValue: null, newValue: '"x"' },
      { id: 1, type: 'label_added' as const, oldValue: null, newValue: '"x"' },
    ];
    const events = [
      forgeEvent({
        sourceEventId: 'label:1',
        type: 'label_added',
        newValue: '"x"',
        occurredAt: '2026-11-09T10:00:00Z',
      }),
      forgeEvent({
        sourceEventId: 'label:2',
        type: 'label_added',
        newValue: '"x"',
        occurredAt: '2026-11-09T10:05:00Z',
      }),
      forgeEvent({
        sourceEventId: 'label:3',
        type: 'label_added',
        newValue: '"x"',
        occurredAt: '2026-11-09T10:10:00Z',
      }),
    ];

    const result = reconcileEvents(provisional, events, new Set());

    expect(result.updates.map((u) => [u.id, u.sourceEventId])).toEqual([
      [1, 'label:1'],
      [2, 'label:2'],
    ]);
    expect(result.inserts.map((e) => e.sourceEventId)).toEqual(['label:3']);
  });

  it('should_skip_forge_events_already_known_so_that_a_rerun_is_idempotent', () => {
    const result = reconcileEvents(
      [{ id: 5, type: 'title_changed', oldValue: null, newValue: null }],
      [forgeEvent()],
      new Set(['note:1']),
    );

    expect(result).toEqual({ updates: [], inserts: [] });
  });

  it('should_never_match_a_comment_with_a_provisional_event', () => {
    const comment = forgeEvent({
      sourceEventId: 'note:9',
      type: 'commented',
      newValue: '"LGTM"',
    });

    const result = reconcileEvents([], [comment], new Set());

    expect(result.inserts).toEqual([comment]);
  });

  it('should_leave_unmatched_provisional_events_untouched', () => {
    const result = reconcileEvents(
      [{ id: 7, type: 'marked_draft', oldValue: 'false', newValue: 'true' }],
      [],
      new Set(),
    );

    expect(result).toEqual({ updates: [], inserts: [] });
  });
});
