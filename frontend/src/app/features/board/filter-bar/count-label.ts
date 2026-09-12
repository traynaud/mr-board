import { MergeRequestView } from '../../../models/merge-request.model';

/** RG-G20 : nombre de lignes affichées et de projets distincts parmi elles. */
export interface CountLabelParts {
  count: number;
  countSuffix: 's' | '';
  projects: number;
  projectsSuffix: 's' | '';
}

export function countLabelParts(mergeRequests: MergeRequestView[]): CountLabelParts {
  const projectCount = new Set(mergeRequests.map((mr) => mr.projectAlias)).size;
  return {
    count: mergeRequests.length,
    countSuffix: mergeRequests.length > 1 ? 's' : '',
    projects: projectCount,
    projectsSuffix: projectCount > 1 ? 's' : '',
  };
}
