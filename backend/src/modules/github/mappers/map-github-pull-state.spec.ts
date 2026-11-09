import {
  isClosedUnmerged,
  mapGithubPullState,
} from './map-github-pull-state.js';

describe('mapGithubPullState', () => {
  it('should_map_a_merged_pull_request_with_merged_by', () => {
    expect(
      mapGithubPullState(
        {
          state: 'closed',
          merged: true,
          merged_at: '2026-11-10T07:03:00Z',
          merged_by: { login: 'bob', avatar_url: 'https://a/bob.png' },
        },
        null,
      ),
    ).toEqual({
      state: 'merged',
      occurredAt: '2026-11-10T07:03:00Z',
      actor: { username: 'bob', name: 'bob', avatarUrl: 'https://a/bob.png' },
    });
  });

  it('should_map_a_closed_unmerged_pull_request_using_the_issue_closed_by', () => {
    expect(
      mapGithubPullState(
        { state: 'closed', closed_at: '2026-11-10T07:10:00Z' },
        { closed_by: { login: 'carol' } },
      ),
    ).toEqual({
      state: 'closed',
      occurredAt: '2026-11-10T07:10:00Z',
      actor: { username: 'carol', name: 'carol', avatarUrl: null },
    });
  });

  it('should_leave_the_actor_empty_when_closed_by_is_unknown', () => {
    expect(
      mapGithubPullState({ state: 'closed' }, { closed_by: null }).actor,
    ).toBeNull();
    expect(mapGithubPullState({ state: 'closed' }, null).actor).toBeNull();
  });

  it('should_map_an_open_pull_request_as_opened', () => {
    expect(mapGithubPullState({ state: 'open' }, null)).toEqual({
      state: 'opened',
      occurredAt: null,
      actor: null,
    });
  });
});

describe('isClosedUnmerged', () => {
  it('should_only_be_true_for_a_closed_pull_request_that_was_not_merged', () => {
    expect(isClosedUnmerged({ state: 'closed' })).toBe(true);
    expect(isClosedUnmerged({ state: 'closed', merged: true })).toBe(false);
    expect(
      isClosedUnmerged({ state: 'closed', merged_at: '2026-11-10T07:03:00Z' }),
    ).toBe(false);
    expect(isClosedUnmerged({ state: 'open' })).toBe(false);
  });
});
