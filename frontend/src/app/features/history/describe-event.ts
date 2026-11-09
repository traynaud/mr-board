import { HistoryEvent, HistoryEventType, HistoryValue } from '../../models/history.model';

/** Couleur de la pastille d'un type d'événement (design US-037). */
export type EventTone = 'success' | 'accent' | 'neutral';

/** Détail affiché sous la phrase d'un événement. */
export type EventDetail =
  | { kind: 'change'; oldValue: string; newValue: string }
  | { kind: 'quote'; text: string };

/** Phrase (sans l'acteur) et détail d'un événement. */
export interface EventDescription {
  /** Clé i18n `history.actions.<type>`. */
  actionKey: string;
  /** Paramètres d'interpolation (`value` : label ou utilisateur concerné). */
  params: Record<string, string>;
  detail: EventDetail | null;
}

const SUCCESS: readonly HistoryEventType[] = ['approved', 'merged'];
const ACCENT: readonly HistoryEventType[] = ['closed', 'deleted', 'disappeared'];

/** Couleur de la pastille selon le type : vert (approuvée, fusionnée), accent (fermée, supprimée), neutre. */
export function toneOf(type: HistoryEventType): EventTone {
  if (SUCCESS.includes(type)) {
    return 'success';
  }
  return ACCENT.includes(type) ? 'accent' : 'neutral';
}

/** Représentation textuelle d'une valeur d'événement (nom d'utilisateur, libellé, texte). */
export function valueText(value: HistoryValue): string {
  if (value === null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'boolean') {
    return String(value);
  }
  return value.name || value.username;
}

/** Décrit un événement : clé de phrase, paramètres et détail éventuel (RG-037-02). */
export function describeEvent(event: HistoryEvent): EventDescription {
  const actionKey = `history.actions.${event.type}`;
  switch (event.type) {
    case 'title_changed':
      return {
        actionKey,
        params: {},
        detail: {
          kind: 'change',
          oldValue: valueText(event.oldValue),
          newValue: valueText(event.newValue),
        },
      };
    case 'commented': {
      const text = valueText(event.newValue);
      return { actionKey, params: {}, detail: text ? { kind: 'quote', text } : null };
    }
    case 'label_added':
    case 'reviewer_added':
    case 'assignee_added':
      return { actionKey, params: { value: valueText(event.newValue) }, detail: null };
    case 'label_removed':
    case 'reviewer_removed':
    case 'assignee_removed':
      return { actionKey, params: { value: valueText(event.oldValue) }, detail: null };
    default:
      return { actionKey, params: {}, detail: null };
  }
}
