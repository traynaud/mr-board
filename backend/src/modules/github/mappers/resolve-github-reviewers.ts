import { ForgeUser } from '../../forges/types/forge-user.js';

/**
 * Resolves the `reviewers` of a pull request (RG-020-08): GitHub removes a
 * user from `reviewRequests` as soon as they submit a review, so the
 * requested list alone would silently drop reviewers who already did their
 * job. `reviewers` is therefore the requested reviewers (GitHub order),
 * followed by the authors of already-submitted reviews (chronological
 * order), deduplicated by username (case-insensitive) and with the pull
 * request's own author excluded either way.
 * @param requestedReviewers users requested as reviewers (Team requests already filtered out by the caller).
 * @param reviewAuthors authors of `latestOpinionatedReviews`, in chronological order.
 * @param authorUsername the pull request author's username — never included, however it got there.
 */
export function resolveGithubReviewers(
  requestedReviewers: ForgeUser[],
  reviewAuthors: ForgeUser[],
  authorUsername: string,
): ForgeUser[] {
  const authorKey = authorUsername.toLowerCase();
  const seen = new Set<string>();
  const reviewers: ForgeUser[] = [];
  for (const user of [...requestedReviewers, ...reviewAuthors]) {
    const key = user.username.toLowerCase();
    if (key === authorKey || seen.has(key)) {
      continue;
    }
    seen.add(key);
    reviewers.push(user);
  }
  return reviewers;
}
