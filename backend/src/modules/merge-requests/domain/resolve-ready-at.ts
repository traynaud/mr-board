/** Snapshot of a merge request as it stood in base before this sync. */
export interface ExistingMergeRequestReadyState {
  draft: boolean;
  readyAt: string | null;
}

export interface ResolveReadyAtParams {
  /** `null` when the merge request has never been synced before. */
  existing: ExistingMergeRequestReadyState | null;
  incomingDraft: boolean;
  /** `created_at` as reported by GitLab, used only on first insertion. */
  gitlabCreatedAt: string;
  /** Timestamp of the current synchronisation ("now"), ISO 8601 UTC. */
  now: string;
}

/**
 * Computes `ready_at` following exactly the RG-004-04 transition table: an
 * already-set value must never be rewritten while the merge request stays
 * non-draft (US-007's "Depuis Ready" delay depends entirely on this
 * stability).
 * @see RG-004-04
 */
export function resolveReadyAt(params: ResolveReadyAtParams): string | null {
  const { existing, incomingDraft, gitlabCreatedAt, now } = params;
  if (!existing) {
    return incomingDraft ? null : gitlabCreatedAt;
  }
  if (incomingDraft) {
    // Draft → draft stays null ; non-draft → draft resets to null.
    return existing.draft ? existing.readyAt : null;
  }
  // Draft → non-draft is "born" now ; non-draft → non-draft never changes.
  return existing.draft ? now : existing.readyAt;
}
