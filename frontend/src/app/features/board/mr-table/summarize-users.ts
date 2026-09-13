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
 * @param highlightMe quand vrai (défaut), promeut en position affichée
 * (`first`) le premier utilisateur `isMe` trouvé, sans changer `tooltip` ni
 * `extraCount`, qui restent calculés sur l'ordre GitLab d'origine (RG-023-06).
 */
export function summarizeUsers(
  users: MergeRequestUser[],
  highlightMe = true,
): UserGroupSummary {
  if (users.length === 0) {
    return { first: null, extraCount: 0, tooltip: '' };
  }
  const first = highlightMe ? (users.find((user) => user.isMe) ?? users[0]) : users[0];
  return {
    first,
    extraCount: users.length - 1,
    tooltip: users.map((user) => user.name).join(', '),
  };
}
