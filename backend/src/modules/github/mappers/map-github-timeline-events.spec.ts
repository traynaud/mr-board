import {
  GithubTimelineItem,
  mapGithubTimelineEvents,
} from './map-github-timeline-events.js';

const SINCE = '2026-11-09T09:00:00Z';
const alice = { login: 'alice', avatar_url: 'https://a/alice.png' };

function item(overrides: GithubTimelineItem): GithubTimelineItem {
  return {
    id: 1,
    created_at: '2026-11-09T10:00:00Z',
    actor: alice,
    ...overrides,
  };
}

const map = (items: GithubTimelineItem[]) =>
  mapGithubTimelineEvents(items, SINCE);

describe('mapGithubTimelineEvents', () => {
  it('should_map_a_rename_with_old_and_new_titles', () => {
    expect(
      map([item({ event: 'renamed', rename: { from: 'a', to: 'b' } })]),
    ).toEqual([
      {
        sourceEventId: 'gh:1',
        type: 'title_changed',
        occurredAt: '2026-11-09T10:00:00Z',
        actor: {
          username: 'alice',
          name: 'alice',
          avatarUrl: 'https://a/alice.png',
        },
        oldValue: '"a"',
        newValue: '"b"',
      },
    ]);
  });

  it('should_map_draft_and_ready_transitions', () => {
    const events = map([
      item({ id: 1, event: 'convert_to_draft' }),
      item({
        id: 2,
        event: 'ready_for_review',
        created_at: '2026-11-09T10:01:00Z',
      }),
    ]);
    expect(events.map((e) => e.type)).toEqual(['marked_draft', 'marked_ready']);
  });

  it('should_map_review_requests_and_assignments_to_the_target_user', () => {
    const events = map([
      item({
        id: 1,
        event: 'review_requested',
        requested_reviewer: { login: 'bob' },
      }),
      item({
        id: 2,
        event: 'review_request_removed',
        requested_reviewer: { login: 'bob' },
      }),
      item({ id: 3, event: 'assigned', assignee: { login: 'carol' } }),
      item({ id: 4, event: 'unassigned', assignee: { login: 'carol' } }),
    ]);
    expect(events.map((e) => [e.type, e.oldValue, e.newValue])).toEqual([
      ['reviewer_added', null, '{"username":"bob","name":"bob"}'],
      ['reviewer_removed', '{"username":"bob","name":"bob"}', null],
      ['assignee_added', null, '{"username":"carol","name":"carol"}'],
      ['assignee_removed', '{"username":"carol","name":"carol"}', null],
    ]);
    expect(events[0]?.actor?.username).toBe('alice');
  });

  it('should_map_labels', () => {
    const events = map([
      item({ id: 1, event: 'labeled', label: { name: 'bug' } }),
      item({ id: 2, event: 'unlabeled', label: { name: 'bug' } }),
    ]);
    expect(events.map((e) => [e.type, e.oldValue, e.newValue])).toEqual([
      ['label_added', null, '"bug"'],
      ['label_removed', '"bug"', null],
    ]);
  });

  it('should_map_only_approved_reviews_using_the_submission_date_and_reviewer', () => {
    const events = map([
      item({
        id: 1,
        event: 'reviewed',
        state: 'approved',
        user: { login: 'dave' },
        actor: undefined,
        created_at: undefined,
        submitted_at: '2026-11-09T11:00:00Z',
      }),
      item({
        id: 2,
        event: 'reviewed',
        state: 'commented',
        user: { login: 'dave' },
        submitted_at: '2026-11-09T11:00:00Z',
      }),
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'approved',
      occurredAt: '2026-11-09T11:00:00Z',
      actor: { username: 'dave' },
      newValue: '{"username":"dave","name":"dave"}',
    });
  });

  it('should_map_comments_to_an_excerpt_attributed_to_the_commenter', () => {
    const [event] = map([
      item({ event: 'commented', user: { login: 'erin' }, body: 'Looks good' }),
    ]);
    expect(event).toMatchObject({
      type: 'commented',
      actor: { username: 'erin' },
      newValue: '"Looks good"',
    });
  });

  it('should_fall_back_on_the_node_id_and_skip_items_without_identifier_or_date', () => {
    const events = map([
      item({ id: undefined, node_id: 'MDE', event: 'convert_to_draft' }),
      item({ id: undefined, event: 'convert_to_draft' }),
      item({ id: 9, event: 'convert_to_draft', created_at: undefined }),
    ]);
    expect(events.map((e) => e.sourceEventId)).toEqual(['gh:MDE']);
  });

  it('should_ignore_events_before_since_and_unsupported_events', () => {
    expect(
      map([
        item({
          id: 1,
          event: 'convert_to_draft',
          created_at: '2026-11-09T08:00:00Z',
        }),
        item({ id: 2, event: 'committed' }),
        item({ id: 3, event: 'merged' }),
      ]),
    ).toEqual([]);
  });
});
