/** Auteur, reviewer ou affecté, tel qu'embarqué dans `MergeRequestView`. */
export interface MergeRequestUser {
  username: string;
  name: string;
  avatarUrl: string | null;
}

export type Difficulty = 'easy' | 'medium' | 'hard';

export type ReadyLevel = 'green' | 'orange' | 'red';

export type SortKey = 'ready' | 'diff';
export type SortDirection = 'asc' | 'desc';

/** État de tri du tableau (RG-008-*). Toujours une colonne active, jamais d'état « sans tri » (RG-008-03). */
export interface MergeRequestSort {
  key: SortKey;
  direction: SortDirection;
}

/**
 * Miroir de `MergeRequestViewDto` (backend). Volontairement minimal :
 * ni `labels` — ajouté par l'US qui l'affiche (US-015).
 */
export interface MergeRequestView {
  id: number;
  projectAlias: string;
  iid: number;
  title: string;
  webUrl: string;
  draft: boolean;
  author: MergeRequestUser;
  reviewers: MergeRequestUser[];
  assignees: MergeRequestUser[];
  approved: boolean;
  commentsCount: number;
  difficulty: Difficulty;
  /** `null` quand les statistiques de diff sont indisponibles (RG-006-02). */
  changedFiles: number | null;
  additions: number | null;
  deletions: number | null;
  changedLines: number | null;
  /** ISO 8601, date d'ouverture GitLab. */
  createdAt: string;
  /** ISO 8601 ; `null` pour un draft. */
  readyAt: string | null;
  /** `null` pour un draft (RG-007-01). */
  readyDays: number | null;
  /** `null` pour un draft (RG-007-01). */
  readyLevel: ReadyLevel | null;
  /** Jours écoulés depuis `createdAt`, affiché uniquement pour un draft (RG-007-05). */
  openedDays: number;
  /** `true` si je suis auteur, reviewer ou affecté (RG-G09). Non affiché visuellement dans cette US. */
  isMine: boolean;
}

/** Réponse de `GET /merge-requests` (RG-009-02) : les MRs et d'éventuels avertissements non bloquants. */
export interface MergeRequestsResponse {
  mergeRequests: MergeRequestView[];
  /** Ex. `"identity.missing"` quand `mine=1` a été demandé sans identité configurée. */
  warnings: string[];
}

/** État des filtres rapides (RG-009-01/02). */
export interface MergeRequestFilters {
  drafts: boolean;
  mine: boolean;
}

/** Les 5 filtres composables (RG-010-01). */
export type FilterKey = 'project' | 'author' | 'assigned' | 'approved' | 'commented';

/** Ordre d'affichage du menu « Ajouter un filtre » (RG-010-03). */
export const ALL_FILTER_KEYS: FilterKey[] = [
  'project',
  'author',
  'assigned',
  'approved',
  'commented',
];

/** `project`/`author`/`assigned` sont des filtres multi-sélection ; `approved`/`commented` sont booléens. */
export function isMultiValueFilter(key: FilterKey): key is 'project' | 'author' | 'assigned' {
  return key === 'project' || key === 'author' || key === 'assigned';
}

/** État des 5 filtres composables (RG-010-01/02). `'nobody'` est une valeur comme une autre dans `assigned`. */
export interface ComposableFilters {
  project: string[];
  author: string[];
  assigned: string[];
  approved: 'yes' | 'no' | null;
  commented: 'yes' | 'no' | null;
}

export const EMPTY_COMPOSABLE_FILTERS: ComposableFilters = {
  project: [],
  author: [],
  assigned: [],
  approved: null,
  commented: null,
};

/** Une option sélectionnable d'un menu de filtre, avec son compteur contextuel (RG-010-07/08). */
export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

/** Réponse de `GET /merge-requests/facets` (RG-010-07). */
export interface MergeRequestsFacets {
  project: FacetOption[];
  author: FacetOption[];
  /** `'nobody'` toujours en première position (RG-010-05). */
  assigned: FacetOption[];
  /** 2 entrées, `value: 'yes'|'no'`. */
  approved: FacetOption[];
  commented: FacetOption[];
}
