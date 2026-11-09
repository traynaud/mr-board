import { buildTerminalEvent } from './build-terminal-event.js';

const MR = { mrIid: 12, requestedAt: '2026-11-10T08:00:00.000Z' };
const BOB = { username: 'bob', name: 'Bob', avatarUrl: null };

describe('buildTerminalEvent', () => {
  it('should_build_a_merged_event_dated_and_attributed_by_the_forge', () => {
    expect(
      buildTerminalEvent(
        { state: 'merged', occurredAt: '2026-11-10T07:03:00Z', actor: BOB },
        MR,
      ),
    ).toEqual({
      sourceEventId: 'state:merged:2026-11-10T07:03:00Z',
      type: 'merged',
      occurredAt: '2026-11-10T07:03:00Z',
      actor: BOB,
      oldValue: '"opened"',
      newValue: '"merged"',
    });
  });

  it('should_build_a_closed_event', () => {
    const event = buildTerminalEvent(
      { state: 'closed', occurredAt: '2026-11-10T07:10:00Z', actor: BOB },
      MR,
    );
    expect(event).toMatchObject({
      type: 'closed',
      newValue: '"closed"',
      sourceEventId: 'state:closed:2026-11-10T07:10:00Z',
    });
  });

  it('should_fall_back_on_the_request_date_when_the_forge_gives_no_date', () => {
    const event = buildTerminalEvent(
      { state: 'closed', occurredAt: null, actor: null },
      MR,
    );
    expect(event).toMatchObject({
      occurredAt: '2026-11-10T08:00:00.000Z',
      actor: null,
    });
  });

  it('should_build_a_deleted_event_with_an_unknown_actor_when_the_mr_is_not_found', () => {
    expect(buildTerminalEvent(null, MR)).toEqual({
      sourceEventId: 'deleted:12:2026-11-10T08:00:00.000Z',
      type: 'deleted',
      occurredAt: '2026-11-10T08:00:00.000Z',
      actor: null,
      oldValue: '"opened"',
      newValue: null,
    });
  });

  it('should_build_nothing_when_the_mr_is_still_opened', () => {
    expect(
      buildTerminalEvent(
        { state: 'opened', occurredAt: null, actor: null },
        MR,
      ),
    ).toBeNull();
  });
});
