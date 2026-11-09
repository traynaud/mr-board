import {
  GitlabLabelEvent,
  GitlabNote,
  excerptOf,
  mapGitlabNotesToEvents,
  parseGitlabSystemNote,
} from './map-gitlab-notes-to-events.js';

const ALICE = { username: 'alice', name: 'Alice', avatarUrl: null };
const SINCE = '2026-11-09T09:00:00Z';

function note(overrides: Partial<GitlabNote> = {}): GitlabNote {
  return {
    id: 1,
    body: 'LGTM',
    system: false,
    created_at: '2026-11-09T10:00:00Z',
    author: { username: 'alice', name: 'Alice', avatar_url: null },
    ...overrides,
  };
}

const types = (body: string) =>
  parseGitlabSystemNote(body, ALICE).map((c) => c.type);

describe('parseGitlabSystemNote', () => {
  it('should_recognise_a_title_change_without_values', () => {
    expect(
      parseGitlabSystemNote(
        'changed title from **Fix {-login-}** to **Fix {+login redirect+}**',
        ALICE,
      ),
    ).toEqual([{ type: 'title_changed', oldValue: null, newValue: null }]);
  });

  it('should_recognise_draft_and_ready', () => {
    expect(types('marked this merge request as **draft**')).toEqual([
      'marked_draft',
    ]);
    expect(types('marked this merge request as **ready**')).toEqual([
      'marked_ready',
    ]);
  });

  it('should_attribute_approvals_to_the_note_author', () => {
    const [approved] = parseGitlabSystemNote(
      'approved this merge request',
      ALICE,
    );
    expect(approved).toEqual({
      type: 'approved',
      oldValue: null,
      newValue: '{"username":"alice","name":"Alice"}',
    });
    expect(types('unapproved this merge request')).toEqual([
      'approval_removed',
    ]);
  });

  it('should_return_one_reviewer_event_per_mentioned_user', () => {
    const changes = parseGitlabSystemNote(
      'requested review from @bob, @carol and @dave.smith',
      ALICE,
    );
    expect(changes.map((c) => c.newValue)).toEqual([
      '{"username":"bob","name":"bob"}',
      '{"username":"carol","name":"carol"}',
      '{"username":"dave.smith","name":"dave.smith"}',
    ]);
    expect(types('removed review request for @bob')).toEqual([
      'reviewer_removed',
    ]);
  });

  it('should_split_a_combined_assignment_note', () => {
    expect(types('assigned to @bob and unassigned @carol')).toEqual([
      'assignee_added',
      'assignee_removed',
    ]);
    expect(types('unassigned @carol')).toEqual(['assignee_removed']);
    expect(types('assigned to @bob')).toEqual(['assignee_added']);
  });

  it('should_ignore_unrecognised_notes', () => {
    expect(types('added 3 commits')).toEqual([]);
    expect(types('merged')).toEqual([]);
  });
});

describe('excerptOf', () => {
  it('should_collapse_whitespace_and_truncate_to_200_characters', () => {
    expect(excerptOf('a\n\n  b')).toBe('a b');
    const long = excerptOf('x'.repeat(500));
    expect(long).toHaveLength(200);
    expect(long.endsWith('…')).toBe(true);
  });
});

describe('mapGitlabNotesToEvents', () => {
  it('should_map_a_user_note_to_a_commented_event_with_an_excerpt', () => {
    const [event] = mapGitlabNotesToEvents([note({ id: 7 })], [], SINCE);
    expect(event).toEqual({
      sourceEventId: 'note:7',
      type: 'commented',
      occurredAt: '2026-11-09T10:00:00Z',
      actor: ALICE,
      oldValue: null,
      newValue: '"LGTM"',
    });
  });

  it('should_give_each_change_of_a_system_note_its_own_identifier', () => {
    const events = mapGitlabNotesToEvents(
      [
        note({
          id: 8,
          system: true,
          body: 'requested review from @bob and @carol',
        }),
      ],
      [],
      SINCE,
    );
    expect(events.map((e) => e.sourceEventId)).toEqual([
      'note:8:0',
      'note:8:1',
    ]);
  });

  it('should_ignore_notes_older_than_since', () => {
    const events = mapGitlabNotesToEvents(
      [note({ created_at: '2026-11-09T08:59:59Z' })],
      [],
      SINCE,
    );
    expect(events).toEqual([]);
  });

  it('should_map_label_events_and_skip_deleted_labels', () => {
    const labelEvents: GitlabLabelEvent[] = [
      {
        id: 1,
        created_at: '2026-11-09T10:00:00Z',
        user: { username: 'bob', name: 'Bob' },
        label: { name: 'bug' },
        action: 'add',
      },
      {
        id: 2,
        created_at: '2026-11-09T10:05:00Z',
        user: null,
        label: { name: 'old' },
        action: 'remove',
      },
      {
        id: 3,
        created_at: '2026-11-09T10:06:00Z',
        user: null,
        label: null,
        action: 'add',
      },
    ];

    const events = mapGitlabNotesToEvents([], labelEvents, SINCE);

    expect(
      events.map((e) => [e.sourceEventId, e.type, e.actor?.username]),
    ).toEqual([
      ['label:1', 'label_added', 'bob'],
      ['label:2', 'label_removed', undefined],
    ]);
    expect(events[1]).toMatchObject({ oldValue: '"old"', newValue: null });
  });

  it('should_sort_events_chronologically_across_notes_and_labels', () => {
    const events = mapGitlabNotesToEvents(
      [note({ id: 1, created_at: '2026-11-09T11:00:00Z' })],
      [
        {
          id: 1,
          created_at: '2026-11-09T10:00:00Z',
          user: null,
          label: { name: 'x' },
          action: 'add',
        },
      ],
      SINCE,
    );
    expect(events.map((e) => e.sourceEventId)).toEqual(['label:1', 'note:1']);
  });
});
