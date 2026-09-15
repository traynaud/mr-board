import { computeGithubMergeStatus } from './compute-github-merge-status.js';

const base = {
  mergeable: 'MERGEABLE',
  mergeStateStatus: 'CLEAN',
  reviewDecision: null as string | null,
  statusCheckRollupState: null as string | null,
};

describe('computeGithubMergeStatus', () => {
  it('should_be_mergeable_when_clean_with_no_pipeline', () => {
    expect(computeGithubMergeStatus(base)).toEqual({
      state: 'mergeable',
      reasons: [],
    });
  });

  it.each(['HAS_HOOKS', 'UNSTABLE'])(
    'should_be_mergeable_for_the_clean_ish_state_%s',
    (mergeStateStatus) => {
      expect(computeGithubMergeStatus({ ...base, mergeStateStatus })).toEqual({
        state: 'mergeable',
        reasons: [],
      });
    },
  );

  it('should_be_unknown_when_mergeable_is_unknown_even_with_other_signals', () => {
    expect(
      computeGithubMergeStatus({
        ...base,
        mergeable: 'UNKNOWN',
        statusCheckRollupState: 'FAILURE',
      }),
    ).toEqual({ state: 'unknown', reasons: [] });
  });

  it('should_be_unknown_when_merge_state_status_is_unknown', () => {
    expect(
      computeGithubMergeStatus({ ...base, mergeStateStatus: 'UNKNOWN' }),
    ).toEqual({ state: 'unknown', reasons: [] });
  });

  it('should_be_unknown_for_a_draft_with_no_other_blocking_signal', () => {
    // RG-017-05 : DRAFT n'est jamais interprété comme "clean".
    expect(
      computeGithubMergeStatus({ ...base, mergeStateStatus: 'DRAFT' }),
    ).toEqual({ state: 'unknown', reasons: [] });
  });

  it('should_report_conflicts_from_mergeable_conflicting', () => {
    expect(
      computeGithubMergeStatus({ ...base, mergeable: 'CONFLICTING' }),
    ).toEqual({ state: 'blocked', reasons: [{ code: 'conflicts' }] });
  });

  it('should_report_conflicts_from_merge_state_status_dirty', () => {
    expect(
      computeGithubMergeStatus({ ...base, mergeStateStatus: 'DIRTY' }),
    ).toEqual({ state: 'blocked', reasons: [{ code: 'conflicts' }] });
  });

  it.each(['FAILURE', 'ERROR'])(
    'should_report_pipeline_failed_for_%s',
    (statusCheckRollupState) => {
      expect(
        computeGithubMergeStatus({ ...base, statusCheckRollupState }),
      ).toEqual({ state: 'blocked', reasons: [{ code: 'pipeline_failed' }] });
    },
  );

  it.each(['PENDING', 'EXPECTED'])(
    'should_report_pipeline_running_for_%s',
    (statusCheckRollupState) => {
      expect(
        computeGithubMergeStatus({ ...base, statusCheckRollupState }),
      ).toEqual({ state: 'blocked', reasons: [{ code: 'pipeline_running' }] });
    },
  );

  it('should_never_report_pipeline_missing', () => {
    expect(
      computeGithubMergeStatus({ ...base, statusCheckRollupState: null }),
    ).toEqual({ state: 'mergeable', reasons: [] });
  });

  it('should_report_changes_requested', () => {
    expect(
      computeGithubMergeStatus({
        ...base,
        reviewDecision: 'CHANGES_REQUESTED',
      }),
    ).toEqual({ state: 'blocked', reasons: [{ code: 'changes_requested' }] });
  });

  it('should_report_not_approved_without_a_count', () => {
    expect(
      computeGithubMergeStatus({ ...base, reviewDecision: 'REVIEW_REQUIRED' }),
    ).toEqual({ state: 'blocked', reasons: [{ code: 'not_approved' }] });
  });

  it('should_never_report_discussions_unresolved', () => {
    expect(computeGithubMergeStatus(base).reasons).not.toContainEqual(
      expect.objectContaining({ code: 'discussions_unresolved' }),
    );
  });

  it('should_report_need_rebase_when_behind', () => {
    expect(
      computeGithubMergeStatus({ ...base, mergeStateStatus: 'BEHIND' }),
    ).toEqual({ state: 'blocked', reasons: [{ code: 'need_rebase' }] });
  });

  it('should_never_report_blocked_by_mr', () => {
    expect(computeGithubMergeStatus(base).reasons).not.toContainEqual(
      expect.objectContaining({ code: 'blocked_by_mr' }),
    );
  });

  it('should_report_policy_only_when_no_other_reason_explains_the_block', () => {
    expect(
      computeGithubMergeStatus({
        ...base,
        mergeStateStatus: 'BLOCKED',
        statusCheckRollupState: 'SUCCESS',
      }),
    ).toEqual({ state: 'blocked', reasons: [{ code: 'policy' }] });
  });

  it('should_not_report_policy_when_another_reason_already_explains_the_block', () => {
    const result = computeGithubMergeStatus({
      mergeable: 'CONFLICTING',
      mergeStateStatus: 'BLOCKED',
      reviewDecision: null,
      statusCheckRollupState: null,
    });
    expect(result.reasons).not.toContainEqual(
      expect.objectContaining({ code: 'policy' }),
    );
  });

  it('should_never_report_other', () => {
    expect(computeGithubMergeStatus(base).reasons).not.toContainEqual(
      expect.objectContaining({ code: 'other' }),
    );
  });

  it('should_accumulate_every_matching_reason_in_order', () => {
    // Scénario « Statut bloqué » des specs US-020.
    expect(
      computeGithubMergeStatus({
        mergeable: 'CONFLICTING',
        mergeStateStatus: 'CLEAN',
        reviewDecision: 'CHANGES_REQUESTED',
        statusCheckRollupState: 'FAILURE',
      }),
    ).toEqual({
      state: 'blocked',
      reasons: [
        { code: 'conflicts' },
        { code: 'pipeline_failed' },
        { code: 'changes_requested' },
      ],
    });
  });
});
