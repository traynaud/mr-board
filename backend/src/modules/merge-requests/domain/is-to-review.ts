/**
 * RG-032-01: a merge request is "to review" when nobody has picked it up
 * yet — no reviewer AND no user comment (RG-G08). Assignees and approvals
 * are deliberately not considered.
 */
export function isToReview(mergeRequest: {
  reviewers: readonly unknown[];
  commentsCount: number;
}): boolean {
  return (
    mergeRequest.reviewers.length === 0 && mergeRequest.commentsCount === 0
  );
}
