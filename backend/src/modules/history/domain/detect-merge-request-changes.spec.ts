import { detectMergeRequestChanges } from './detect-merge-request-changes.js';
import { MergeRequestSnapshot } from './merge-request-snapshot.js';

function snapshot(
  overrides: Partial<MergeRequestSnapshot> = {},
): MergeRequestSnapshot {
  return {
    iid: 12,
    title: 'Fix login',
    webUrl: 'https://gitlab.example.com/-/merge_requests/12',
    draft: false,
    labels: [],
    reviewers: [],
    assignees: [],
    approvers: [],
    commentsCount: 0,
    ...overrides,
  };
}

const ALICE = { remoteUserId: '1', username: 'alice', name: 'Alice' };
const BOB = { remoteUserId: '2', username: 'bob', name: 'Bob' };

describe('detectMergeRequestChanges', () => {
  it('should_return_no_change_when_nothing_differs', () => {
    const result = detectMergeRequestChanges(snapshot(), snapshot());
    expect(result).toEqual({ changes: [], needsEnrichment: false });
  });

  it('should_return_created_when_there_is_no_previous_state', () => {
    const result = detectMergeRequestChanges(null, snapshot());
    expect(result.changes).toEqual([
      { type: 'created', oldValue: null, newValue: '"Fix login"' },
    ]);
    expect(result.needsEnrichment).toBe(true);
  });

  it('should_return_title_changed_when_title_differs', () => {
    const result = detectMergeRequestChanges(
      snapshot(),
      snapshot({ title: 'Fix login redirect' }),
    );
    expect(result.changes).toEqual([
      {
        type: 'title_changed',
        oldValue: '"Fix login"',
        newValue: '"Fix login redirect"',
      },
    ]);
    expect(result.needsEnrichment).toBe(true);
  });

  it('should_return_marked_draft_when_mr_becomes_draft', () => {
    const result = detectMergeRequestChanges(
      snapshot(),
      snapshot({ draft: true }),
    );
    expect(result.changes).toEqual([
      { type: 'marked_draft', oldValue: 'false', newValue: 'true' },
    ]);
  });

  it('should_return_marked_ready_when_mr_leaves_draft', () => {
    const result = detectMergeRequestChanges(
      snapshot({ draft: true }),
      snapshot({ draft: false }),
    );
    expect(result.changes).toEqual([
      { type: 'marked_ready', oldValue: 'true', newValue: 'false' },
    ]);
  });

  it('should_return_one_event_per_label_added_or_removed_sorted', () => {
    const result = detectMergeRequestChanges(
      snapshot({ labels: ['bug', 'old'] }),
      snapshot({ labels: ['bug', 'zeta', 'alpha'] }),
    );
    expect(result.changes).toEqual([
      { type: 'label_added', oldValue: null, newValue: '"alpha"' },
      { type: 'label_added', oldValue: null, newValue: '"zeta"' },
      { type: 'label_removed', oldValue: '"old"', newValue: null },
    ]);
  });

  it('should_return_reviewer_and_assignee_changes_by_remote_user_id', () => {
    const result = detectMergeRequestChanges(
      snapshot({ reviewers: [ALICE], assignees: [BOB] }),
      snapshot({ reviewers: [BOB], assignees: [BOB, ALICE] }),
    );
    expect(result.changes.map((c) => c.type)).toEqual([
      'reviewer_added',
      'reviewer_removed',
      'assignee_added',
    ]);
    expect(result.changes[0]?.newValue).toBe('{"username":"bob","name":"Bob"}');
    expect(result.changes[1]?.oldValue).toBe(
      '{"username":"alice","name":"Alice"}',
    );
  });

  it('should_sort_several_added_and_removed_users_by_username', () => {
    const carol = { remoteUserId: '3', username: 'carol', name: 'Carol' };
    const added = detectMergeRequestChanges(
      snapshot(),
      snapshot({ reviewers: [carol, BOB, ALICE] }),
    );
    expect(
      added.changes.map(
        (c) =>
          (JSON.parse(c.newValue ?? '{}') as { username: string }).username,
      ),
    ).toEqual(['alice', 'bob', 'carol']);
    const removed = detectMergeRequestChanges(
      snapshot({ reviewers: [carol, ALICE] }),
      snapshot(),
    );
    expect(
      removed.changes.map(
        (c) =>
          (JSON.parse(c.oldValue ?? '{}') as { username: string }).username,
      ),
    ).toEqual(['alice', 'carol']);
  });

  it('should_return_approved_and_approval_removed_for_approvers', () => {
    const added = detectMergeRequestChanges(
      snapshot(),
      snapshot({ approvers: [ALICE] }),
    );
    expect(added.changes.map((c) => c.type)).toEqual(['approved']);
    const removed = detectMergeRequestChanges(
      snapshot({ approvers: [ALICE] }),
      snapshot(),
    );
    expect(removed.changes.map((c) => c.type)).toEqual(['approval_removed']);
  });

  it('should_not_flag_a_change_when_only_the_user_name_differs', () => {
    const result = detectMergeRequestChanges(
      snapshot({ reviewers: [ALICE] }),
      snapshot({ reviewers: [{ ...ALICE, name: 'Alice D.' }] }),
    );
    expect(result.changes).toEqual([]);
  });

  it('should_request_enrichment_without_event_when_comments_increase', () => {
    const result = detectMergeRequestChanges(
      snapshot({ commentsCount: 2 }),
      snapshot({ commentsCount: 3 }),
    );
    expect(result).toEqual({ changes: [], needsEnrichment: true });
  });

  it('should_not_request_enrichment_when_comments_decrease', () => {
    const result = detectMergeRequestChanges(
      snapshot({ commentsCount: 3 }),
      snapshot({ commentsCount: 2 }),
    );
    expect(result).toEqual({ changes: [], needsEnrichment: false });
  });

  it('should_order_events_title_draft_labels_reviewers_assignees_approvals', () => {
    const result = detectMergeRequestChanges(
      snapshot(),
      snapshot({
        title: 'New',
        draft: true,
        labels: ['x'],
        reviewers: [ALICE],
        assignees: [ALICE],
        approvers: [ALICE],
      }),
    );
    expect(result.changes.map((c) => c.type)).toEqual([
      'title_changed',
      'marked_draft',
      'label_added',
      'reviewer_added',
      'assignee_added',
      'approved',
    ]);
  });
});
