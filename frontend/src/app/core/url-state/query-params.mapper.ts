import {
  DEFAULT_SORT,
  FilterKey,
  MergeRequestSort,
  SORT_DIRECTIONS,
  SORT_KEYS,
  SortDirection,
  SortKey,
  isMultiValueFilter,
} from '../../models/merge-request.model';

/** État complet du tableau reflété dans l'URL (RG-011-01). */
export interface UrlState {
  drafts: boolean;
  mine: boolean;
  /** Filtres composables actifs (pastilles affichées), reconstruit depuis la présence des clés dans l'URL. */
  active: FilterKey[];
  project: string[];
  author: string[];
  assigned: string[];
  approved: 'yes' | 'no' | null;
  commented: 'yes' | 'no' | null;
  sort: MergeRequestSort;
  /** RG-011-09 : visibilité de la colonne « Date d'ouverture ». */
  showOpened: boolean;
}

/**
 * Normalise `ActivatedRoute.snapshot.queryParams` (typé `Params`, càd
 * `{[key: string]: any}` côté Angular) vers des chaînes simples : une clé
 * répétée dans l'URL (`?drafts=1&drafts=2`) donne un tableau — on ne garde
 * alors que la première valeur, plutôt que de la propager telle quelle
 * (`decodeQueryParams` suppose des valeurs scalaires).
 */
export function normalizeParams(params: Record<string, unknown>): Record<string, string | undefined> {
  const normalized: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      normalized[key] = value;
    } else if (Array.isArray(value) && typeof value[0] === 'string') {
      normalized[key] = value[0] as string;
    }
  }
  return normalized;
}

/**
 * Query params → état (RG-011-02/04) : miroir du mapping déjà fait côté
 * backend (`merge-requests.controller.ts`, `toComposableFilters`/`toYesNo`).
 * Ne valide jamais les valeurs de `project`/`author`/`assigned` — RG-010-09
 * (déjà en place dans `MergeRequestsStore.load()`) les nettoie après le
 * premier chargement des facets.
 */
export function decodeQueryParams(params: Record<string, string | undefined>): UrlState {
  const active: FilterKey[] = [];

  const project = decodeListFilter('project', params, active);
  const author = decodeListFilter('author', params, active);
  const assigned = decodeListFilter('assigned', params, active);
  const approved = decodeBooleanFilter('approved', params, active);
  const commented = decodeBooleanFilter('commented', params, active);

  return {
    drafts: params['drafts'] === '1',
    mine: params['mine'] === '1',
    active,
    project,
    author,
    assigned,
    approved,
    commented,
    sort: decodeSort(params['sort']),
    showOpened: decodeCols(params['cols']),
  };
}

/**
 * État → query params (RG-011-01, ordre stable), pour `router.navigate` et
 * l'affichage en pied de page (RG-011-06). `drafts`/`mine`/`sort` toujours
 * présents ; un filtre actif sans valeur reste présent (`author=''`), pour
 * que l'encodage soit l'inverse exact de `decodeQueryParams` (RG-011-08).
 */
export function encodeQueryParams(state: UrlState): Record<string, string> {
  const params: Record<string, string> = {
    drafts: state.drafts ? '1' : '0',
    mine: state.mine ? '1' : '0',
  };
  for (const key of state.active) {
    params[key] = isMultiValueFilter(key) ? state[key].join(',') : encodeBooleanValue(state[key]);
  }
  params['sort'] = `${state.sort.key}:${state.sort.direction}`;
  if (state.showOpened) {
    params['cols'] = 'opened';
  }
  return params;
}

function decodeListFilter(
  key: 'project' | 'author' | 'assigned',
  params: Record<string, string | undefined>,
  active: FilterKey[],
): string[] {
  const raw = params[key];
  if (raw === undefined) {
    return [];
  }
  active.push(key);
  return raw.split(',').filter(Boolean);
}

function decodeBooleanFilter(
  key: 'approved' | 'commented',
  params: Record<string, string | undefined>,
  active: FilterKey[],
): 'yes' | 'no' | null {
  const raw = params[key];
  if (raw === undefined) {
    return null;
  }
  active.push(key);
  if (raw === '1') {
    return 'yes';
  }
  if (raw === '0') {
    return 'no';
  }
  return null;
}

function encodeBooleanValue(value: 'yes' | 'no' | null): string {
  if (value === null) {
    return '';
  }
  return value === 'yes' ? '1' : '0';
}

function isSortKey(value: string): value is SortKey {
  return (SORT_KEYS as readonly string[]).includes(value);
}

function isSortDirection(value: string): value is SortDirection {
  return (SORT_DIRECTIONS as readonly string[]).includes(value);
}

function decodeSort(raw: string | undefined): MergeRequestSort {
  if (!raw) {
    return DEFAULT_SORT;
  }
  const [key, direction] = raw.split(':');
  if (!isSortKey(key) || !isSortDirection(direction)) {
    return DEFAULT_SORT;
  }
  return { key, direction };
}

function decodeCols(raw: string | undefined): boolean {
  return (raw ?? '').split(',').filter(Boolean).includes('opened');
}
