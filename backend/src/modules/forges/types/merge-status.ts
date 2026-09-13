export type MergeStatusState = 'mergeable' | 'blocked' | 'unknown';

/** The 11 reason codes of RG-017-04, generic across forges (RG-017-02, EPIC-001). */
export type MergeStatusReasonCode =
  | 'conflicts'
  | 'pipeline_failed'
  | 'pipeline_running'
  | 'pipeline_missing'
  | 'changes_requested'
  | 'not_approved'
  | 'discussions_unresolved'
  | 'need_rebase'
  | 'blocked_by_mr'
  | 'policy'
  | 'other';

export interface MergeStatusReason {
  code: MergeStatusReasonCode;
  /** Only set for `not_approved` and `discussions_unresolved` (RG-017-06). */
  count?: number;
}

/**
 * A merge/pull request's mergeability, already normalised by the forge's own
 * mapper (US-019, RG-019-21) — persisted as-is on `MergeRequest`, never
 * recomputed from forge-specific raw signals at read time.
 */
export interface MergeStatusResult {
  state: MergeStatusState;
  /** Ordered per RG-017-04, deduplicated (each code appears at most once by construction). */
  reasons: MergeStatusReason[];
}
