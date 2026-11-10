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

/** Filtres de la timeline (US-038, RG-038-01). Les bornes sont des jours locaux `AAAA-MM-JJ`. */
export interface HistoryFilters {
  /** Recherche sur le titre / numéro de la MR, `''` = aucune (RG-038-05). */
  search: string;
  types: HistoryEventType[];
  /** `username` des acteurs, `UNKNOWN_ACTOR` pour « Inconnu » (RG-038-07). */
  actors: string[];
  /** Identifiants de projets. */
  projects: number[];
  /** Premier jour inclus, `null` = pas de borne basse (RG-038-09). */
  from: string | null;
  /** Dernier jour inclus, `null` = pas de borne haute (RG-038-09). */
  to: string | null;
}

/** Filtres de la barre ayant une pastille (la recherche est toujours visible). */
export type HistoryFilterKey = 'type' | 'actor' | 'project' | 'period';

export const HISTORY_FILTER_KEYS: readonly HistoryFilterKey[] = ['type', 'actor', 'project', 'period'];

/** Valeur réservée du filtre Acteur pour les événements sans acteur identifié (RG-038-07). */
export const UNKNOWN_ACTOR = 'none';

export const EMPTY_HISTORY_FILTERS: HistoryFilters = {
  search: '',
  types: [],
  actors: [],
  projects: [],
  from: null,
  to: null,
};

/** Acteur sélectionnable du filtre Acteur (`GET /history/actors`). */
export interface HistoryActorOption {
  username: string;
  name: string | null;
  avatarUrl: string | null;
}
