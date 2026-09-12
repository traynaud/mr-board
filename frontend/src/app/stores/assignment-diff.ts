import { MergeRequestView } from '../models/merge-request.model';

/** MR nouvellement assignée à l'utilisateur courant (RG-016-01/02). */
export interface NewAssignment {
  id: number;
  projectAlias: string;
  iid: number;
  title: string;
  webUrl: string;
}

function isAssignedTo(mr: MergeRequestView, username: string): boolean {
  const lower = username.toLowerCase();
  return (
    mr.reviewers.some((u) => u.username.toLowerCase() === lower) ||
    mr.assignees.some((u) => u.username.toLowerCase() === lower)
  );
}

/**
 * Détecte les MRs devenues assignées (reviewer ou assigné) à `username`
 * entre deux chargements (RG-016-01), en ignorant les drafts (RG-016-03).
 * Une MR absente de `previous` compte comme nouvelle si elle est déjà
 * assignée dès le premier chargement où elle apparaît.
 */
export function findNewAssignments(
  previous: MergeRequestView[],
  current: MergeRequestView[],
  username: string,
): NewAssignment[] {
  if (!username) {
    return [];
  }
  const previousById = new Map(previous.map((mr) => [mr.id, mr]));
  const newAssignments: NewAssignment[] = [];
  for (const mr of current) {
    if (mr.draft || !isAssignedTo(mr, username)) {
      continue;
    }
    const before = previousById.get(mr.id);
    if (before && isAssignedTo(before, username)) {
      continue;
    }
    newAssignments.push({
      id: mr.id,
      projectAlias: mr.projectAlias,
      iid: mr.iid,
      title: mr.title,
      webUrl: mr.webUrl,
    });
  }
  return newAssignments;
}
