import {
  HISTORY_EVENT_TYPES,
  HISTORY_FILTER_KEYS,
  HistoryEventType,
  HistoryFilterKey,
  HistoryFilters,
} from '../../models/history.model';

/** Longueur maximale de la recherche (RG-038-05). */
export const HISTORY_SEARCH_MAX_LENGTH = 100;

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Vrai si `value` est un jour calendaire `AAAA-MM-JJ` réel (ex. pas `2026-13-45`). */
export function isValidDay(value: string): boolean {
  if (!DAY_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Vrai si au moins un filtre (recherche comprise) a une valeur. */
export function hasAnyHistoryFilter(filters: HistoryFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.types.length > 0 ||
    filters.actors.length > 0 ||
    filters.projects.length > 0 ||
    filters.from !== null ||
    filters.to !== null
  );
}

/** Pastilles qui portent une valeur (RG-038-12), dans l'ordre canonique. */
export function activeKeysOf(filters: HistoryFilters): HistoryFilterKey[] {
  return HISTORY_FILTER_KEYS.filter((key) => {
    switch (key) {
      case 'type':
        return filters.types.length > 0;
      case 'actor':
        return filters.actors.length > 0;
      case 'project':
        return filters.projects.length > 0;
      case 'period':
        return filters.from !== null || filters.to !== null;
    }
  });
}

/** Valeur d'un paramètre d'URL : une clé répétée ne garde que la première occurrence. */
function firstValue(params: Record<string, unknown>, key: string): string | undefined {
  const raw = params[key];
  if (typeof raw === 'string') {
    return raw;
  }
  return Array.isArray(raw) && typeof raw[0] === 'string' ? (raw[0] as string) : undefined;
}

function listOf(raw: string | undefined): string[] {
  return raw === undefined ? [] : raw.split(',').filter(Boolean);
}

/**
 * Query params de `/history` → filtres (RG-038-14). Les types inconnus, projets non numériques et
 * dates mal formées sont écartés ; la recherche est tronquée à 100 caractères.
 */
export function decodeHistoryQuery(params: Record<string, unknown>): HistoryFilters {
  const known = new Set<string>(HISTORY_EVENT_TYPES);
  const from = firstValue(params, 'from');
  const to = firstValue(params, 'to');
  return {
    search: (firstValue(params, 'q') ?? '').slice(0, HISTORY_SEARCH_MAX_LENGTH),
    types: listOf(firstValue(params, 'type')).filter((type): type is HistoryEventType =>
      known.has(type),
    ),
    actors: listOf(firstValue(params, 'actor')),
    projects: listOf(firstValue(params, 'project'))
      .filter((id) => /^\d+$/.test(id))
      .map(Number),
    from: from !== undefined && isValidDay(from) ? from : null,
    to: to !== undefined && isValidDay(to) ? to : null,
  };
}

/** Filtres → query params de `/history` ; les filtres sans valeur sont omis (RG-038-12). */
export function encodeHistoryQuery(filters: HistoryFilters): Record<string, string | null> {
  return {
    q: filters.search.trim() !== '' ? filters.search : null,
    type: filters.types.length > 0 ? filters.types.join(',') : null,
    actor: filters.actors.length > 0 ? filters.actors.join(',') : null,
    project: filters.projects.length > 0 ? filters.projects.join(',') : null,
    from: filters.from,
    to: filters.to,
  };
}

/** `AAAA-MM-JJ` (local) → `Date` locale à minuit. */
export function dayToDate(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
}

/** `Date` → `AAAA-MM-JJ` (jour local). */
export function dateToDay(date: Date): string {
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
