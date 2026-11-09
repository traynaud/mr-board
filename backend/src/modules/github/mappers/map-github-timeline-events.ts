import {
  ForgeEventActor,
  ForgeMergeRequestEvent,
} from '../../forges/types/forge-merge-request-event.js';
import { HistoryEventType } from '../../history/entities/merge-request-event.entity.js';
import { excerptOf } from '../../gitlab/mappers/map-gitlab-notes-to-events.js';

interface GithubUserRef {
  login: string;
  avatar_url?: string | null;
}

/** Subset of an item of `GET /repos/{o}/{r}/issues/{n}/timeline`. */
export interface GithubTimelineItem {
  id?: number;
  node_id?: string;
  event?: string;
  created_at?: string;
  submitted_at?: string;
  actor?: GithubUserRef | null;
  user?: GithubUserRef | null;
  body?: string | null;
  state?: string;
  rename?: { from: string; to: string };
  label?: { name: string };
  assignee?: GithubUserRef | null;
  requested_reviewer?: GithubUserRef | null;
}

function toActor(
  user: GithubUserRef | null | undefined,
): ForgeEventActor | null {
  return user
    ? {
        username: user.login,
        name: user.login,
        avatarUrl: user.avatar_url ?? null,
      }
    : null;
}

function userValue(user: GithubUserRef | null | undefined): string | null {
  return user
    ? JSON.stringify({ username: user.login, name: user.login })
    : null;
}

/**
 * Maps a GitHub timeline onto forge events (RG-034-04), keeping only those at
 * or after `since`. Merge/close/reopen are US-035. Items without a usable id
 * or date are ignored.
 */
export function mapGithubTimelineEvents(
  items: GithubTimelineItem[],
  since: string,
): ForgeMergeRequestEvent[] {
  const sinceTime = new Date(since).getTime();
  const events: ForgeMergeRequestEvent[] = [];

  for (const item of items) {
    const occurredAt =
      item.event === 'reviewed' ? item.submitted_at : item.created_at;
    const rawId = item.id ?? item.node_id;
    if (
      !occurredAt ||
      rawId === undefined ||
      new Date(occurredAt).getTime() < sinceTime
    ) {
      continue;
    }
    const base = {
      sourceEventId: `gh:${String(rawId)}`,
      occurredAt,
      actor: toActor(item.actor),
    };
    const push = (
      type: HistoryEventType,
      oldValue: string | null,
      newValue: string | null,
      actor: ForgeEventActor | null = base.actor,
    ): void => {
      events.push({ ...base, actor, type, oldValue, newValue });
    };

    switch (item.event) {
      case 'renamed':
        if (item.rename) {
          push(
            'title_changed',
            JSON.stringify(item.rename.from),
            JSON.stringify(item.rename.to),
          );
        }
        break;
      case 'convert_to_draft':
        push('marked_draft', 'false', 'true');
        break;
      case 'ready_for_review':
        push('marked_ready', 'true', 'false');
        break;
      case 'review_requested':
        push('reviewer_added', null, userValue(item.requested_reviewer));
        break;
      case 'review_request_removed':
        push('reviewer_removed', userValue(item.requested_reviewer), null);
        break;
      case 'assigned':
        push('assignee_added', null, userValue(item.assignee));
        break;
      case 'unassigned':
        push('assignee_removed', userValue(item.assignee), null);
        break;
      case 'labeled':
        if (item.label) {
          push('label_added', null, JSON.stringify(item.label.name));
        }
        break;
      case 'unlabeled':
        if (item.label) {
          push('label_removed', JSON.stringify(item.label.name), null);
        }
        break;
      case 'reviewed':
        if (item.state?.toLowerCase() === 'approved') {
          push('approved', null, userValue(item.user), toActor(item.user));
        }
        break;
      case 'commented':
        push(
          'commented',
          null,
          JSON.stringify(excerptOf(item.body ?? '')),
          toActor(item.user),
        );
        break;
      default:
        break;
    }
  }

  return events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}
