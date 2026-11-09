import { HistoryEventType } from '../entities/merge-request-event.entity.js';
import {
  MergeRequestSnapshot,
  SnapshotUser,
} from './merge-request-snapshot.js';

/** A change inferred from two states; values are JSON-serialised (RG-033-02). */
export interface DetectedChange {
  type: HistoryEventType;
  oldValue: string | null;
  newValue: string | null;
}

export interface DetectionResult {
  /** Provisional events, in deterministic order (RG-033-04). */
  changes: DetectedChange[];
  /** Whether the merge request must be queued for forge enrichment (RG-034-01). */
  needsEnrichment: boolean;
}

/**
 * Compares the stored state of a merge request with the incoming one
 * (RG-033-01). `previous === null` means the merge request is new: a
 * `created` event is produced. A higher comment count produces no event
 * (comments come from the forge, US-034) but requests enrichment.
 * Order: title, draft, labels (added then removed), reviewers, assignees,
 * approvals — alphabetical within each group.
 */
export function detectMergeRequestChanges(
  previous: MergeRequestSnapshot | null,
  incoming: MergeRequestSnapshot,
): DetectionResult {
  if (previous === null) {
    return {
      changes: [
        {
          type: 'created',
          oldValue: null,
          newValue: JSON.stringify(incoming.title),
        },
      ],
      needsEnrichment: true,
    };
  }

  const changes: DetectedChange[] = [];

  if (previous.title !== incoming.title) {
    changes.push({
      type: 'title_changed',
      oldValue: JSON.stringify(previous.title),
      newValue: JSON.stringify(incoming.title),
    });
  }
  if (previous.draft !== incoming.draft) {
    changes.push({
      type: incoming.draft ? 'marked_draft' : 'marked_ready',
      oldValue: JSON.stringify(previous.draft),
      newValue: JSON.stringify(incoming.draft),
    });
  }

  const labelDiff = diffStrings(previous.labels, incoming.labels);
  for (const label of labelDiff.added) {
    changes.push({
      type: 'label_added',
      oldValue: null,
      newValue: JSON.stringify(label),
    });
  }
  for (const label of labelDiff.removed) {
    changes.push({
      type: 'label_removed',
      oldValue: JSON.stringify(label),
      newValue: null,
    });
  }

  pushUserChanges(
    changes,
    previous.reviewers,
    incoming.reviewers,
    'reviewer_added',
    'reviewer_removed',
  );
  pushUserChanges(
    changes,
    previous.assignees,
    incoming.assignees,
    'assignee_added',
    'assignee_removed',
  );
  pushUserChanges(
    changes,
    previous.approvers,
    incoming.approvers,
    'approved',
    'approval_removed',
  );

  return {
    changes,
    needsEnrichment:
      changes.length > 0 || incoming.commentsCount > previous.commentsCount,
  };
}

function diffStrings(
  before: string[],
  after: string[],
): { added: string[]; removed: string[] } {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    added: [...afterSet].filter((value) => !beforeSet.has(value)).sort(),
    removed: [...beforeSet].filter((value) => !afterSet.has(value)).sort(),
  };
}

function userValue(user: SnapshotUser): string {
  return JSON.stringify({ username: user.username, name: user.name });
}

function pushUserChanges(
  changes: DetectedChange[],
  before: SnapshotUser[],
  after: SnapshotUser[],
  addedType: HistoryEventType,
  removedType: HistoryEventType,
): void {
  const beforeIds = new Set(before.map((user) => user.remoteUserId));
  const afterIds = new Set(after.map((user) => user.remoteUserId));
  const byUsername = (a: SnapshotUser, b: SnapshotUser): number =>
    a.username.localeCompare(b.username);
  const added = after
    .filter((user) => !beforeIds.has(user.remoteUserId))
    .sort(byUsername);
  const removed = before
    .filter((user) => !afterIds.has(user.remoteUserId))
    .sort(byUsername);
  for (const user of added) {
    changes.push({
      type: addedType,
      oldValue: null,
      newValue: userValue(user),
    });
  }
  for (const user of removed) {
    changes.push({
      type: removedType,
      oldValue: userValue(user),
      newValue: null,
    });
  }
}
