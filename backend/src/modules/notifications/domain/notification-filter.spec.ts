import {
  buildRevision,
  isEligible,
  NotifiableEvent,
  NotificationFilter,
} from './notification-filter.js';

const ME = new Map<number, string | null>([[1, 'Me']]);
const NO_FILTER: NotificationFilter = {
  disabledTypes: [],
  onlyMine: false,
  excludeOwn: false,
};

function event(overrides: Partial<NotifiableEvent> = {}): NotifiableEvent {
  return {
    type: 'commented',
    actorUsername: 'alice',
    connectionId: 1,
    mrInvolvedUsernames: '["bob"]',
    ...overrides,
  };
}

describe('isEligible', () => {
  it('should_keep_everything_without_any_restriction', () => {
    expect(isEligible(event(), NO_FILTER, ME)).toBe(true);
  });

  it('should_hide_a_disabled_type', () => {
    const filter = { ...NO_FILTER, disabledTypes: ['commented' as const] };
    expect(isEligible(event(), filter, ME)).toBe(false);
    expect(isEligible(event({ type: 'approved' }), filter, ME)).toBe(true);
  });

  it('should_exclude_my_own_actions_case_insensitively', () => {
    const filter = { ...NO_FILTER, excludeOwn: true };
    expect(isEligible(event({ actorUsername: 'ME' }), filter, ME)).toBe(false);
    expect(isEligible(event({ actorUsername: 'alice' }), filter, ME)).toBe(
      true,
    );
  });

  it('should_never_exclude_an_unknown_actor', () => {
    const filter = { ...NO_FILTER, excludeOwn: true };
    expect(isEligible(event({ actorUsername: null }), filter, ME)).toBe(true);
  });

  it('should_keep_only_the_events_of_the_mrs_that_concern_me', () => {
    const filter = { ...NO_FILTER, onlyMine: true };
    expect(
      isEligible(event({ mrInvolvedUsernames: '["bob","me"]' }), filter, ME),
    ).toBe(true);
    expect(
      isEligible(event({ mrInvolvedUsernames: '["bob"]' }), filter, ME),
    ).toBe(false);
  });

  it('should_keep_nothing_for_only_mine_when_the_snapshot_is_missing_or_unreadable', () => {
    const filter = { ...NO_FILTER, onlyMine: true };
    expect(isEligible(event({ mrInvolvedUsernames: null }), filter, ME)).toBe(
      false,
    );
    expect(
      isEligible(event({ mrInvolvedUsernames: 'not json' }), filter, ME),
    ).toBe(false);
    expect(
      isEligible(event({ mrInvolvedUsernames: '{"a":1}' }), filter, ME),
    ).toBe(false);
  });

  it('should_keep_nothing_for_only_mine_without_a_resolved_identity', () => {
    const filter = { ...NO_FILTER, onlyMine: true };
    const unresolved = new Map<number, string | null>([[1, null]]);
    expect(
      isEligible(event({ mrInvolvedUsernames: '["me"]' }), filter, unresolved),
    ).toBe(false);
    expect(
      isEligible(event({ mrInvolvedUsernames: '["me"]' }), filter, new Map()),
    ).toBe(false);
  });
});

describe('buildRevision', () => {
  it('should_change_when_the_provisional_count_drops', () => {
    expect(buildRevision(10, 3, 2)).toBe('10:3:2');
    expect(buildRevision(10, 3, 1)).not.toBe(buildRevision(10, 3, 2));
  });
});
