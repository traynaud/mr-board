/**
 * `(projectId, iid)` key shared by favorites and merge requests (RG-027-04)
 * — the identity a favorite is stable against, deliberately never the
 * internal id of a `merge_requests` row (which `deleteMissing`/RG-004-03 can
 * recreate under a new id when a closed MR reopens).
 */
export function favoriteKey(entry: { projectId: number; iid: number }): string {
  return `${entry.projectId}:${entry.iid}`;
}

/**
 * RG-027-01/04: a merge request is a favorite when its `(projectId, iid)`
 * key is present in the caller's precomputed set of favorite keys.
 */
export function isFavorite(
  mergeRequest: { projectId: number; iid: number },
  favoriteKeys: ReadonlySet<string>,
): boolean {
  return favoriteKeys.has(favoriteKey(mergeRequest));
}
