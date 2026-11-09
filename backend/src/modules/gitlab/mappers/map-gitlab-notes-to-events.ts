import {
  ForgeEventActor,
  ForgeMergeRequestEvent,
} from '../../forges/types/forge-merge-request-event.js';
import { HistoryEventType } from '../../history/entities/merge-request-event.entity.js';

/** Max length of a comment excerpt stored in the journal (RG-034-05). */
export const COMMENT_EXCERPT_LENGTH = 200;

interface GitlabUserRef {
  username: string;
  name: string;
  avatar_url?: string | null;
}

/** Subset of `GET /merge_requests/:iid/notes`. */
export interface GitlabNote {
  id: number;
  body: string;
  system: boolean;
  created_at: string;
  author: GitlabUserRef;
}

/** Subset of `GET /merge_requests/:iid/resource_label_events`. */
export interface GitlabLabelEvent {
  id: number;
  created_at: string;
  user: GitlabUserRef | null;
  label: { name: string } | null;
  action: 'add' | 'remove';
}

interface ParsedSystemChange {
  type: HistoryEventType;
  oldValue: string | null;
  newValue: string | null;
}

const USER_LIST = String.raw`((?:@[\w.-]+(?:, | and |, and )?)+)`;
const REVIEW_REQUESTED = new RegExp(`requested review from ${USER_LIST}`, 'i');
const REVIEW_REMOVED = new RegExp(
  `removed (?:the )?review request for ${USER_LIST}`,
  'i',
);
const ASSIGNED = new RegExp(`(?<!un)assigned to ${USER_LIST}`, 'i');
const UNASSIGNED = new RegExp(`unassigned ${USER_LIST}`, 'i');

function usernames(list: string): string[] {
  return [...list.matchAll(/@([\w.-]+)/g)].map((match) => match[1] ?? '');
}

function userValue(username: string, name = username): string {
  return JSON.stringify({ username, name });
}

/**
 * Interprets the English text of a GitLab *system note* (RG-034-04). Only
 * the catalogue handled by US-034 is recognised; anything else yields `[]`
 * (the provisional event then simply stays provisional). Title changes are
 * recognised without values: GitLab embeds a diff markup in the text.
 * `actor` is the note's author, used for approvals.
 */
export function parseGitlabSystemNote(
  body: string,
  actor: ForgeEventActor,
): ParsedSystemChange[] {
  const text = body.trim();
  const changes: ParsedSystemChange[] = [];

  if (/^changed title from /i.test(text)) {
    changes.push({ type: 'title_changed', oldValue: null, newValue: null });
  }
  if (/^marked (?:this merge request )?as \*\*draft\*\*/i.test(text)) {
    changes.push({ type: 'marked_draft', oldValue: 'false', newValue: 'true' });
  }
  if (/^marked (?:this merge request )?as \*\*ready\*\*/i.test(text)) {
    changes.push({ type: 'marked_ready', oldValue: 'true', newValue: 'false' });
  }
  if (/^approved this merge request/i.test(text)) {
    changes.push({
      type: 'approved',
      oldValue: null,
      newValue: userValue(actor.username, actor.name),
    });
  }
  if (/^unapproved this merge request/i.test(text)) {
    changes.push({
      type: 'approval_removed',
      oldValue: userValue(actor.username, actor.name),
      newValue: null,
    });
  }
  const requested = REVIEW_REQUESTED.exec(text);
  if (requested?.[1]) {
    for (const username of usernames(requested[1])) {
      changes.push({
        type: 'reviewer_added',
        oldValue: null,
        newValue: userValue(username),
      });
    }
  }
  const reviewRemoved = REVIEW_REMOVED.exec(text);
  if (reviewRemoved?.[1]) {
    for (const username of usernames(reviewRemoved[1])) {
      changes.push({
        type: 'reviewer_removed',
        oldValue: userValue(username),
        newValue: null,
      });
    }
  }
  const assigned = ASSIGNED.exec(text);
  if (assigned?.[1]) {
    for (const username of usernames(assigned[1])) {
      changes.push({
        type: 'assignee_added',
        oldValue: null,
        newValue: userValue(username),
      });
    }
  }
  const unassigned = UNASSIGNED.exec(text);
  if (unassigned?.[1]) {
    for (const username of usernames(unassigned[1])) {
      changes.push({
        type: 'assignee_removed',
        oldValue: userValue(username),
        newValue: null,
      });
    }
  }
  return changes;
}

/** Truncates a comment to the stored excerpt (RG-034-05). */
export function excerptOf(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > COMMENT_EXCERPT_LENGTH
    ? `${flat.slice(0, COMMENT_EXCERPT_LENGTH - 1)}…`
    : flat;
}

function toActor(user: GitlabUserRef | null): ForgeEventActor | null {
  return user
    ? {
        username: user.username,
        name: user.name,
        avatarUrl: user.avatar_url ?? null,
      }
    : null;
}

/**
 * Maps GitLab notes and label events onto forge events (RG-034-04), keeping
 * only those at or after `since`. Identifiers: `note:<id>[:<n>]` (a single
 * note may carry several changes) and `label:<id>`.
 */
export function mapGitlabNotesToEvents(
  notes: GitlabNote[],
  labelEvents: GitlabLabelEvent[],
  since: string,
): ForgeMergeRequestEvent[] {
  const sinceTime = new Date(since).getTime();
  const events: ForgeMergeRequestEvent[] = [];

  for (const note of notes) {
    if (new Date(note.created_at).getTime() < sinceTime) {
      continue;
    }
    const actor = toActor(note.author);
    if (!actor) {
      continue;
    }
    if (!note.system) {
      events.push({
        sourceEventId: `note:${note.id}`,
        type: 'commented',
        occurredAt: note.created_at,
        actor,
        oldValue: null,
        newValue: JSON.stringify(excerptOf(note.body)),
      });
      continue;
    }
    parseGitlabSystemNote(note.body, actor).forEach((change, index) => {
      events.push({
        sourceEventId: `note:${note.id}:${index}`,
        type: change.type,
        occurredAt: note.created_at,
        actor,
        oldValue: change.oldValue,
        newValue: change.newValue,
      });
    });
  }

  for (const labelEvent of labelEvents) {
    if (
      !labelEvent.label ||
      new Date(labelEvent.created_at).getTime() < sinceTime
    ) {
      continue;
    }
    const value = JSON.stringify(labelEvent.label.name);
    const added = labelEvent.action === 'add';
    events.push({
      sourceEventId: `label:${labelEvent.id}`,
      type: added ? 'label_added' : 'label_removed',
      occurredAt: labelEvent.created_at,
      actor: toActor(labelEvent.user),
      oldValue: added ? null : value,
      newValue: added ? value : null,
    });
  }

  return events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}
