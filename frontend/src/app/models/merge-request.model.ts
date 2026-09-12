/** Auteur, reviewer ou affecté, tel qu'embarqué dans `MergeRequestView`. */
export interface MergeRequestUser {
  username: string;
  name: string;
  avatarUrl: string | null;
}

export type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * Miroir de `MergeRequestViewDto` (backend). Volontairement minimal :
 * ni `draft`, ni `readyAt`/`readyDays`/`readyLevel` — ces champs seront
 * ajoutés par les US qui les affichent (US-007, US-009…).
 */
export interface MergeRequestView {
  id: number;
  projectAlias: string;
  iid: number;
  title: string;
  webUrl: string;
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
}
