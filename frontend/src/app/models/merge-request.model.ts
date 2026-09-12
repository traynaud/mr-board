/** Auteur, reviewer ou affecté, tel qu'embarqué dans `MergeRequestView`. */
export interface MergeRequestUser {
  username: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * Miroir de `MergeRequestViewDto` (backend). Volontairement minimal :
 * ni `draft`, ni `difficulty`, ni `readyAt`/`readyDays`/`readyLevel` — ces
 * champs seront ajoutés par les US qui les affichent (US-006, US-007…).
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
}
