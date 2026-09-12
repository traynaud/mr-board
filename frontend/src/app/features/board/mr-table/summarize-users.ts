import { MergeRequestUser } from '../../../models/merge-request.model';

export interface UserGroupSummary {
  /** Premier utilisateur (ordre GitLab), `null` si la liste est vide. */
  first: MergeRequestUser | null;
  /** Nombre d'utilisateurs restants au-delà du premier. */
  extraCount: number;
  /** Noms complets séparés par une virgule, pour le tooltip (RG-G06). Vide si aucun utilisateur. */
  tooltip: string;
}

/**
 * Résume une liste de reviewers ou d'assignees pour l'affichage « premier +
 * N » (RG-G06). Utilisée à l'identique pour les colonnes Reviewer et Affecté.
 * @param users reviewers ou assignees d'une MR, dans l'ordre GitLab.
 */
export function summarizeUsers(users: MergeRequestUser[]): UserGroupSummary {
  if (users.length === 0) {
    return { first: null, extraCount: 0, tooltip: '' };
  }
  return {
    first: users[0],
    extraCount: users.length - 1,
    tooltip: users.map((user) => user.name).join(', '),
  };
}
