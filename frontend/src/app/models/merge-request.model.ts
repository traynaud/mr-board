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
}
