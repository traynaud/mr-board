export type MergeStatusState = 'mergeable' | 'blocked' | 'unknown';

/** The 11 reason codes of RG-017-04, generic across forges (RG-017-02). */
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

export interface MergeStatusResult {
  state: MergeStatusState;
  /** Ordered per RG-017-04, deduplicated (each code appears at most once by construction). */
  reasons: MergeStatusReason[];
}

/**
 * Raw mergeability data of a merge request, as persisted on `MergeRequest`
 * (US-017, RG-017-01). All fields are `null` together for a merge request
 * synchronised before this US (RG-017-11) — `approvalsRequired` plays no
 * role in the computation (kept for information/future use only).
 */
export interface MergeStatusInput {
  detailedMergeStatus: string | null;
  conflicts: boolean | null;
  headPipelineStatus: string | null;
  approvalsLeft: number | null;
  resolvableDiscussionsCount: number | null;
  resolvedDiscussionsCount: number | null;
}

/** RG-017-03 : GitLab has not finished evaluating mergeability yet. */
const CHECKING_STATUSES = new Set([
  'UNCHECKED',
  'CHECKING',
  'PREPARING',
  'APPROVALS_SYNCING',
]);

/**
 * RG-017-05 / RG-017-04 (note) : statuses that never produce a reason and
 * are excluded from the `other` fallback — a draft not yet evaluated by
 * GitLab beyond these raw signals, or a merge scheduled/already merged.
 */
const IGNORED_STATUSES = new Set(['DRAFT_STATUS', 'MERGE_TIME', 'NOT_OPEN']);

const PIPELINE_FAILED_STATUSES = new Set(['FAILED', 'CANCELED']);
const PIPELINE_RUNNING_STATUSES = new Set([
  'CREATED',
  'WAITING_FOR_RESOURCE',
  'PREPARING',
  'PENDING',
  'RUNNING',
  'SCHEDULED',
]);
const BLOCKED_BY_MR_STATUSES = new Set([
  'BLOCKED_STATUS',
  'MERGE_REQUEST_BLOCKED',
]);
const POLICY_STATUSES = new Set([
  'EXTERNAL_STATUS_CHECKS',
  'POLICIES_DENIED',
  'SECURITY_POLICY_VIOLATIONS',
  'JIRA_ASSOCIATION_MISSING',
  'TITLE_REGEX',
  'LOCKED_PATHS',
  'LOCKED_LFS_FILES',
  'COMMITS_STATUS',
]);

/**
 * Every `detailedMergeStatus` value directly recognised by a reason code
 * (RG-017-04) — used to know when a value falls through to `other`.
 */
const RECOGNIZED_STATUSES = new Set([
  'CONFLICT',
  'CI_STILL_RUNNING',
  'CI_MUST_PASS',
  'REQUESTED_CHANGES',
  'NOT_APPROVED',
  'DISCUSSIONS_NOT_RESOLVED',
  'NEED_REBASE',
  ...BLOCKED_BY_MR_STATUSES,
  ...POLICY_STATUSES,
]);

/**
 * Computes a merge request's mergeability (US-017, RG-017-02) from the raw
 * GitLab signals persisted at sync time. Pure and forge-agnostic: only the
 * caller knows these values come from GitLab (RG-017-02, EPIC-001).
 *
 * State precedence (RG-017-03): a `null`/still-checking `detailedMergeStatus`
 * always wins as `unknown`, even if a raw signal (e.g. `conflicts`) is
 * already known — GitLab has not finished evaluating mergeability itself.
 * Otherwise, any computed reason makes the merge request `blocked`; with no
 * reason, `state` is `mergeable` only when `detailedMergeStatus` is exactly
 * `MERGEABLE`, `unknown` otherwise (draft not yet evaluated, `MERGE_TIME`,
 * `NOT_OPEN`).
 * @see RG-017-03
 * @see RG-017-04
 * @see RG-017-05
 */
export function computeMergeStatus(input: MergeStatusInput): MergeStatusResult {
  const { detailedMergeStatus } = input;
  if (
    detailedMergeStatus === null ||
    CHECKING_STATUSES.has(detailedMergeStatus)
  ) {
    return { state: 'unknown', reasons: [] };
  }

  const reasons = buildReasons(input);
  if (reasons.length > 0) {
    return { state: 'blocked', reasons };
  }
  if (detailedMergeStatus === 'MERGEABLE') {
    return { state: 'mergeable', reasons: [] };
  }
  return { state: 'unknown', reasons: [] };
}

/** Builds the ordered `reasons` list of RG-017-04, one entry per matching condition. */
function buildReasons(input: MergeStatusInput): MergeStatusReason[] {
  const {
    detailedMergeStatus,
    conflicts,
    headPipelineStatus,
    approvalsLeft,
    resolvableDiscussionsCount,
    resolvedDiscussionsCount,
  } = input;
  const reasons: MergeStatusReason[] = [];

  if (conflicts === true || detailedMergeStatus === 'CONFLICT') {
    reasons.push({ code: 'conflicts' });
  }
  if (
    headPipelineStatus !== null &&
    PIPELINE_FAILED_STATUSES.has(headPipelineStatus)
  ) {
    reasons.push({ code: 'pipeline_failed' });
  }
  if (
    (headPipelineStatus !== null &&
      PIPELINE_RUNNING_STATUSES.has(headPipelineStatus)) ||
    detailedMergeStatus === 'CI_STILL_RUNNING'
  ) {
    reasons.push({ code: 'pipeline_running' });
  }
  if (detailedMergeStatus === 'CI_MUST_PASS' && headPipelineStatus === null) {
    reasons.push({ code: 'pipeline_missing' });
  }
  if (detailedMergeStatus === 'REQUESTED_CHANGES') {
    reasons.push({ code: 'changes_requested' });
  }
  if (
    (approvalsLeft !== null && approvalsLeft > 0) ||
    detailedMergeStatus === 'NOT_APPROVED'
  ) {
    reasons.push({
      code: 'not_approved',
      ...(approvalsLeft !== null && approvalsLeft > 0
        ? { count: approvalsLeft }
        : {}),
    });
  }
  const unresolvedDiscussions =
    resolvableDiscussionsCount !== null && resolvedDiscussionsCount !== null
      ? resolvableDiscussionsCount - resolvedDiscussionsCount
      : null;
  if (
    (unresolvedDiscussions !== null && unresolvedDiscussions > 0) ||
    detailedMergeStatus === 'DISCUSSIONS_NOT_RESOLVED'
  ) {
    reasons.push({
      code: 'discussions_unresolved',
      ...(unresolvedDiscussions !== null && unresolvedDiscussions > 0
        ? { count: unresolvedDiscussions }
        : {}),
    });
  }
  if (detailedMergeStatus === 'NEED_REBASE') {
    reasons.push({ code: 'need_rebase' });
  }
  if (
    detailedMergeStatus !== null &&
    BLOCKED_BY_MR_STATUSES.has(detailedMergeStatus)
  ) {
    reasons.push({ code: 'blocked_by_mr' });
  }
  if (
    detailedMergeStatus !== null &&
    POLICY_STATUSES.has(detailedMergeStatus)
  ) {
    reasons.push({ code: 'policy' });
  }
  if (isUnknownFutureStatus(detailedMergeStatus)) {
    reasons.push({ code: 'other' });
  }
  return reasons;
}

/**
 * RG-017-04 (ligne `other`) : une valeur de `detailedMergeStatus` que cette
 * fonction ne sait pas encore interpréter — ni `MERGEABLE`, ni « en cours de
 * vérification » (RG-017-03), ni ignorée (RG-017-05), ni déjà couverte par
 * un autre code.
 */
function isUnknownFutureStatus(detailedMergeStatus: string | null): boolean {
  return (
    detailedMergeStatus !== null &&
    detailedMergeStatus !== 'MERGEABLE' &&
    !CHECKING_STATUSES.has(detailedMergeStatus) &&
    !IGNORED_STATUSES.has(detailedMergeStatus) &&
    !RECOGNIZED_STATUSES.has(detailedMergeStatus)
  );
}
