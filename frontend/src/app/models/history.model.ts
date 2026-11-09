/** Types d'événements du journal (miroir de `HistoryEventType`, backend). */
export type HistoryEventType =
  | 'created'
  | 'title_changed'
  | 'marked_draft'
  | 'marked_ready'
  | 'approved'
  | 'approval_removed'
  | 'reviewer_added'
  | 'reviewer_removed'
  | 'assignee_added'
  | 'assignee_removed'
  | 'label_added'
  | 'label_removed'
  | 'commented'
  | 'merged'
  | 'closed'
  | 'reopened'
  | 'deleted'
  | 'disappeared';

export const HISTORY_EVENT_TYPES: readonly HistoryEventType[] = [
  'created',
  'title_changed',
  'marked_draft',
  'marked_ready',
  'approved',
  'approval_removed',
  'reviewer_added',
  'reviewer_removed',
  'assignee_added',
  'assignee_removed',
  'label_added',
  'label_removed',
  'commented',
  'merged',
  'closed',
  'reopened',
  'deleted',
  'disappeared',
];

/** Acteur d'un événement ; `null` quand il est inconnu (RG-037-05). */
export interface HistoryActor {
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
}

/** Ancienne / nouvelle valeur désérialisée : texte, booléen (draft) ou utilisateur. */
export type HistoryValue = string | boolean | { username: string; name: string } | null;

/** Miroir de `HistoryEventDto` (backend). */
export interface HistoryEvent {
  id: number;
  occurredAt: string;
  type: HistoryEventType;
  status: 'provisional' | 'confirmed';
  projectId: number;
  projectAlias: string;
  mrIid: number;
  mrTitle: string;
  mrWebUrl: string;
  actor: HistoryActor | null;
  oldValue: HistoryValue;
  newValue: HistoryValue;
}

/** Miroir de `HistoryResponseDto` (backend). */
export interface HistoryResponse {
  events: HistoryEvent[];
  nextCursor: string | null;
  total: number;
}
