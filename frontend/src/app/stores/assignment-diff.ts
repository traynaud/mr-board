import { MergeRequestView } from '../models/merge-request.model';

/** MR nouvellement assignée à l'utilisateur courant (RG-016-01/02). */
export interface NewAssignment {
  id: number;
  projectAlias: string;
  /** Nom de la connexion du projet, utilisé par RG-021-08 dès qu'il en existe au moins deux. */
  connectionName: string;
  iid: number;
  title: string;
  webUrl: string;
}

/**
 * `isMe` est déjà résolu côté serveur par connexion (RG-019-25) — jamais
 * recomparé ici à partir d'un nom d'utilisateur.
 */
function isAssignedToMe(mr: MergeRequestView): boolean {
  return mr.reviewers.some((u) => u.isMe) || mr.assignees.some((u) => u.isMe);
}

/**
 * Détecte les MRs devenues assignées (reviewer ou assigné) à moi entre deux
 * chargements (RG-016-01), en ignorant les drafts (RG-016-03). Une MR
 * absente de `previous` compte comme nouvelle si elle est déjà assignée dès
 * le premier chargement où elle apparaît.
 */
export function findNewAssignments(
  previous: MergeRequestView[],
  current: MergeRequestView[],
): NewAssignment[] {
  const previousById = new Map(previous.map((mr) => [mr.id, mr]));
  const newAssignments: NewAssignment[] = [];
  for (const mr of current) {
    if (mr.draft || !isAssignedToMe(mr)) {
      continue;
    }
    const before = previousById.get(mr.id);
    if (before && isAssignedToMe(before)) {
      continue;
    }
    newAssignments.push({
      id: mr.id,
      projectAlias: mr.projectAlias,
      connectionName: mr.connection.name,
      iid: mr.iid,
      title: mr.title,
      webUrl: mr.webUrl,
    });
  }
  return newAssignments;
}
