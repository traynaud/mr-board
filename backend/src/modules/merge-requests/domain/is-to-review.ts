/**
 * RG-032-01: a merge request is "to review" when nobody has been designated
 * as reviewer. Comments, assignees and approvals are deliberately not
 * considered.
 */
export function isToReview(mergeRequest: {
  reviewers: readonly unknown[];
}): boolean {
  return mergeRequest.reviewers.length === 0;
}
