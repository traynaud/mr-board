import { mapGitlabMergeRequestState } from './map-gitlab-merge-request-state.js';

const bob = { username: 'bob', name: 'Bob', avatar_url: 'https://a/bob.png' };

describe('mapGitlabMergeRequestState', () => {
  it('should_map_a_merged_mr_with_merge_user_date_and_avatar', () => {
    expect(
      mapGitlabMergeRequestState({
        state: 'merged',
        merged_at: '2026-11-10T07:03:00Z',
        merge_user: bob,
      }),
    ).toEqual({
      state: 'merged',
      occurredAt: '2026-11-10T07:03:00Z',
      actor: { username: 'bob', name: 'Bob', avatarUrl: 'https://a/bob.png' },
    });
  });

  it('should_fall_back_on_the_deprecated_merged_by', () => {
    const result = mapGitlabMergeRequestState({
      state: 'merged',
      merged_at: '2026-11-10T07:03:00Z',
      merged_by: { username: 'carol', name: 'Carol' },
    });
    expect(result.actor).toEqual({
      username: 'carol',
      name: 'Carol',
      avatarUrl: null,
    });
  });

  it('should_map_a_closed_mr_with_closed_by', () => {
    expect(
      mapGitlabMergeRequestState({
        state: 'closed',
        closed_at: '2026-11-10T07:10:00Z',
        closed_by: bob,
      }),
    ).toMatchObject({
      state: 'closed',
      occurredAt: '2026-11-10T07:10:00Z',
      actor: { username: 'bob' },
    });
  });

  it('should_leave_date_and_actor_empty_when_the_forge_does_not_give_them', () => {
    expect(mapGitlabMergeRequestState({ state: 'closed' })).toEqual({
      state: 'closed',
      occurredAt: null,
      actor: null,
    });
    expect(mapGitlabMergeRequestState({ state: 'merged' })).toEqual({
      state: 'merged',
      occurredAt: null,
      actor: null,
    });
  });

  it.each(['opened', 'locked', 'something_new'])(
    'should_treat_%s_as_still_opened',
    (state) => {
      expect(mapGitlabMergeRequestState({ state })).toEqual({
        state: 'opened',
        occurredAt: null,
        actor: null,
      });
    },
  );
});
