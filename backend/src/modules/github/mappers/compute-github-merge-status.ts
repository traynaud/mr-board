import {
  MergeStatusReason,
  MergeStatusResult,
} from '../../forges/types/merge-status';

/**
 * Raw GitHub mergeability signals for one pull request (RG-020-09).
 * `statusCheckRollupState` is the state of the last commit's status check
 * rollup (`null` when there is no pipeline yet).
 */
export interface GithubMergeStatusInput {
  mergeable: string;
  mergeStateStatus: string;
  reviewDecision: string | null;
  statusCheckRollupState: string | null;
}

const PIPELINE_FAILED_STATES = new Set(['FAILURE', 'ERROR']);
const PIPELINE_RUNNING_STATES = new Set(['PENDING', 'EXPECTED']);

/**
 * RG-020-09 (final state row): `mergeStateStatus` values compatible with a
 * `mergeable` outcome once `mergeable = MERGEABLE` and no reason was found —
 * deliberately excludes `DRAFT` (RG-017-05: a draft with no other blocking
 * signal is `unknown`, never miscategorised as clean).
 */
const CLEAN_MERGE_STATE_STATUSES = new Set(['CLEAN', 'HAS_HOOKS', 'UNSTABLE']);

/**
 * Computes a pull request's mergeability (RG-020-09) from the raw GitHub
 * signals fetched at sync time — GitHub's own mapper implementation of the
 * forge-agnostic `mergeStatus` required by `ForgeMergeRequest` (RG-019-21).
 * Pure; called once per pull request at mapping time.
 *
 * State precedence: `mergeable = UNKNOWN` or `mergeStateStatus = UNKNOWN`
 * always wins as `unknown` (GitHub has not finished evaluating mergeability
 * yet), even before any reason is computed. Otherwise, any computed reason
 * makes the pull request `blocked`; with no reason, `state` is `mergeable`
 * only when `mergeable = MERGEABLE` and `mergeStateStatus` is one of the
 * clean-ish values above, `unknown` otherwise (draft not yet ready,
 * `BEHIND`/`BLOCKED` already covered by a reason, or any other status).
 * @see RG-020-09
 */
export function computeGithubMergeStatus(
  input: GithubMergeStatusInput,
): MergeStatusResult {
  const { mergeable, mergeStateStatus } = input;
  if (mergeable === 'UNKNOWN' || mergeStateStatus === 'UNKNOWN') {
    return { state: 'unknown', reasons: [] };
  }

  const reasons = buildReasons(input);
  if (reasons.length > 0) {
    return { state: 'blocked', reasons };
  }
  if (
    mergeable === 'MERGEABLE' &&
    CLEAN_MERGE_STATE_STATUSES.has(mergeStateStatus)
  ) {
    return { state: 'mergeable', reasons: [] };
  }
  return { state: 'unknown', reasons: [] };
}

/** Builds the ordered `reasons` list of RG-020-09, one entry per matching condition. */
function buildReasons(input: GithubMergeStatusInput): MergeStatusReason[] {
  const {
    mergeable,
    mergeStateStatus,
    reviewDecision,
    statusCheckRollupState,
  } = input;
  const reasons: MergeStatusReason[] = [];

  if (mergeable === 'CONFLICTING' || mergeStateStatus === 'DIRTY') {
    reasons.push({ code: 'conflicts' });
  }
  if (
    statusCheckRollupState !== null &&
    PIPELINE_FAILED_STATES.has(statusCheckRollupState)
  ) {
    reasons.push({ code: 'pipeline_failed' });
  }
  if (
    statusCheckRollupState !== null &&
    PIPELINE_RUNNING_STATES.has(statusCheckRollupState)
  ) {
    reasons.push({ code: 'pipeline_running' });
  }
  if (reviewDecision === 'CHANGES_REQUESTED') {
    reasons.push({ code: 'changes_requested' });
  }
  // RG-020-09: no `count` — GitHub does not expose how many approvals remain.
  if (reviewDecision === 'REVIEW_REQUIRED') {
    reasons.push({ code: 'not_approved' });
  }
  if (mergeStateStatus === 'BEHIND') {
    reasons.push({ code: 'need_rebase' });
  }
  // Only when nothing else already explains the block (RG-020-09).
  if (mergeStateStatus === 'BLOCKED' && reasons.length === 0) {
    reasons.push({ code: 'policy' });
  }
  return reasons;
}
