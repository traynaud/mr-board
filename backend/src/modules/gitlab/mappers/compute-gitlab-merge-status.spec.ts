import {
  GitlabMergeStatusInput,
  computeGitlabMergeStatus,
} from './compute-gitlab-merge-status.js';

function input(
  overrides: Partial<GitlabMergeStatusInput> = {},
): GitlabMergeStatusInput {
  return {
    detailedMergeStatus: 'MERGEABLE',
    conflicts: false,
    headPipelineStatus: 'SUCCESS',
    approvalsLeft: 0,
    resolvableDiscussionsCount: 0,
    resolvedDiscussionsCount: 0,
    ...overrides,
  };
}

describe('computeGitlabMergeStatus', () => {
  it('should_report_mergeable_when_gitlab_reports_mergeable_and_nothing_blocks', () => {
    // Scenario: MR fusionnable
    expect(computeGitlabMergeStatus(input())).toEqual({
      state: 'mergeable',
      reasons: [],
    });
  });

  it('should_report_unknown_when_data_is_absent', () => {
    // Scenario: MR synchronisée avant la mise à jour
    expect(
      computeGitlabMergeStatus(
        input({
          detailedMergeStatus: null,
          conflicts: null,
          headPipelineStatus: null,
          approvalsLeft: null,
          resolvableDiscussionsCount: null,
          resolvedDiscussionsCount: null,
        }),
      ),
    ).toEqual({ state: 'unknown', reasons: [] });
  });

  it.each(['UNCHECKED', 'CHECKING', 'PREPARING', 'APPROVALS_SYNCING'])(
    'should_report_unknown_when_gitlab_is_still_checking (%s)',
    (status) => {
      // Scenario: Statut indéterminé
      expect(
        computeGitlabMergeStatus(input({ detailedMergeStatus: status })),
      ).toEqual({ state: 'unknown', reasons: [] });
    },
  );

  it('should_report_unknown_even_when_a_raw_signal_is_already_blocking_while_gitlab_is_still_checking', () => {
    // RG-017-03 : priorité de l'état « en cours de vérification » sur les
    // signaux bruts déjà connus.
    expect(
      computeGitlabMergeStatus(
        input({ detailedMergeStatus: 'CHECKING', conflicts: true }),
      ),
    ).toEqual({ state: 'unknown', reasons: [] });
  });

  it('should_report_blocked_with_the_conflicts_reason', () => {
    expect(
      computeGitlabMergeStatus(
        input({ conflicts: true, detailedMergeStatus: 'CONFLICT' }),
      ),
    ).toEqual({ state: 'blocked', reasons: [{ code: 'conflicts' }] });
  });

  it('should_report_conflicts_from_the_boolean_flag_alone', () => {
    expect(
      computeGitlabMergeStatus(
        input({ conflicts: true, detailedMergeStatus: 'MERGEABLE' }),
      ),
    ).toEqual({ state: 'blocked', reasons: [{ code: 'conflicts' }] });
  });

  it.each(['FAILED', 'CANCELED'])(
    'should_report_pipeline_failed_regardless_of_the_project_ci_requirement (%s)',
    (status) => {
      // Scenario: Pipeline en échec sur un projet qui ne l'exige pas
      expect(
        computeGitlabMergeStatus(
          input({
            detailedMergeStatus: 'MERGEABLE',
            headPipelineStatus: status,
          }),
        ),
      ).toEqual({ state: 'blocked', reasons: [{ code: 'pipeline_failed' }] });
    },
  );

  it.each([
    'CREATED',
    'WAITING_FOR_RESOURCE',
    'PREPARING',
    'PENDING',
    'RUNNING',
    'SCHEDULED',
  ])(
    'should_report_pipeline_running_from_the_pipeline_status_alone (%s)',
    (status) => {
      expect(
        computeGitlabMergeStatus(
          input({
            detailedMergeStatus: 'CI_STILL_RUNNING',
            headPipelineStatus: status,
          }),
        ),
      ).toEqual({ state: 'blocked', reasons: [{ code: 'pipeline_running' }] });
    },
  );

  it('should_report_pipeline_running_from_ci_still_running_alone', () => {
    // Scenario: Pipeline en cours
    expect(
      computeGitlabMergeStatus(
        input({
          detailedMergeStatus: 'CI_STILL_RUNNING',
          headPipelineStatus: 'RUNNING',
        }),
      ),
    ).toEqual({ state: 'blocked', reasons: [{ code: 'pipeline_running' }] });
  });

  it('should_report_pipeline_missing_when_ci_must_pass_and_no_pipeline', () => {
    expect(
      computeGitlabMergeStatus(
        input({
          detailedMergeStatus: 'CI_MUST_PASS',
          headPipelineStatus: null,
        }),
      ),
    ).toEqual({ state: 'blocked', reasons: [{ code: 'pipeline_missing' }] });
  });

  it('should_report_changes_requested', () => {
    expect(
      computeGitlabMergeStatus(
        input({ detailedMergeStatus: 'REQUESTED_CHANGES' }),
      ),
    ).toEqual({ state: 'blocked', reasons: [{ code: 'changes_requested' }] });
  });

  it('should_report_not_approved_with_the_remaining_count', () => {
    expect(
      computeGitlabMergeStatus(
        input({ detailedMergeStatus: 'NOT_APPROVED', approvalsLeft: 2 }),
      ),
    ).toEqual({
      state: 'blocked',
      reasons: [{ code: 'not_approved', count: 2 }],
    });
  });

  it('should_report_not_approved_without_a_count_when_approvals_left_is_unavailable', () => {
    expect(
      computeGitlabMergeStatus(
        input({ detailedMergeStatus: 'NOT_APPROVED', approvalsLeft: null }),
      ),
    ).toEqual({ state: 'blocked', reasons: [{ code: 'not_approved' }] });
  });

  it('should_report_discussions_unresolved_with_the_remaining_count', () => {
    // Scenario: Discussions non résolues comptées
    expect(
      computeGitlabMergeStatus(
        input({ resolvableDiscussionsCount: 5, resolvedDiscussionsCount: 3 }),
      ),
    ).toEqual({
      state: 'blocked',
      reasons: [{ code: 'discussions_unresolved', count: 2 }],
    });
  });

  it('should_report_discussions_unresolved_without_a_count_when_the_counts_are_unavailable', () => {
    expect(
      computeGitlabMergeStatus(
        input({
          detailedMergeStatus: 'DISCUSSIONS_NOT_RESOLVED',
          resolvableDiscussionsCount: null,
          resolvedDiscussionsCount: null,
        }),
      ),
    ).toEqual({
      state: 'blocked',
      reasons: [{ code: 'discussions_unresolved' }],
    });
  });

  it('should_not_report_discussions_unresolved_when_everything_is_resolved', () => {
    expect(
      computeGitlabMergeStatus(
        input({ resolvableDiscussionsCount: 3, resolvedDiscussionsCount: 3 }),
      ),
    ).toEqual({ state: 'mergeable', reasons: [] });
  });

  it('should_report_need_rebase', () => {
    expect(
      computeGitlabMergeStatus(input({ detailedMergeStatus: 'NEED_REBASE' })),
    ).toEqual({ state: 'blocked', reasons: [{ code: 'need_rebase' }] });
  });

  it.each(['BLOCKED_STATUS', 'MERGE_REQUEST_BLOCKED'])(
    'should_report_blocked_by_mr (%s)',
    (status) => {
      expect(
        computeGitlabMergeStatus(input({ detailedMergeStatus: status })),
      ).toEqual({
        state: 'blocked',
        reasons: [{ code: 'blocked_by_mr' }],
      });
    },
  );

  it.each([
    'EXTERNAL_STATUS_CHECKS',
    'POLICIES_DENIED',
    'SECURITY_POLICY_VIOLATIONS',
    'JIRA_ASSOCIATION_MISSING',
    'TITLE_REGEX',
    'LOCKED_PATHS',
    'LOCKED_LFS_FILES',
    'COMMITS_STATUS',
  ])('should_report_policy (%s)', (status) => {
    expect(
      computeGitlabMergeStatus(input({ detailedMergeStatus: status })),
    ).toEqual({
      state: 'blocked',
      reasons: [{ code: 'policy' }],
    });
  });

  it('should_report_other_for_an_unrecognised_future_gitlab_status', () => {
    // Scenario: Valeur inconnue de GitLab
    expect(
      computeGitlabMergeStatus(input({ detailedMergeStatus: 'SOMETHING_NEW' })),
    ).toEqual({ state: 'blocked', reasons: [{ code: 'other' }] });
  });

  it.each(['MERGE_TIME', 'NOT_OPEN'])(
    'should_never_report_a_reason_for_an_ignored_status_with_no_blocking_signal (%s)',
    (status) => {
      expect(
        computeGitlabMergeStatus(input({ detailedMergeStatus: status })),
      ).toEqual({
        state: 'unknown',
        reasons: [],
      });
    },
  );

  it('should_report_multiple_reasons_in_the_rg_017_04_order_without_duplicates', () => {
    // Scenario: MR bloquée pour plusieurs raisons
    expect(
      computeGitlabMergeStatus(
        input({
          detailedMergeStatus: 'CONFLICT',
          conflicts: true,
          headPipelineStatus: 'FAILED',
          approvalsLeft: 2,
        }),
      ),
    ).toEqual({
      state: 'blocked',
      reasons: [
        { code: 'conflicts' },
        { code: 'pipeline_failed' },
        { code: 'not_approved', count: 2 },
      ],
    });
  });

  describe('drafts (RG-017-05)', () => {
    it('should_report_blocked_with_the_conflicts_reason_for_a_draft_with_conflicts', () => {
      // Scenario: Draft avec conflits
      expect(
        computeGitlabMergeStatus(
          input({
            detailedMergeStatus: 'DRAFT_STATUS',
            conflicts: true,
            headPipelineStatus: 'SUCCESS',
          }),
        ),
      ).toEqual({ state: 'blocked', reasons: [{ code: 'conflicts' }] });
    });

    it('should_report_unknown_for_a_draft_with_no_blocking_signal', () => {
      // Scenario: Draft sans signal bloquant
      expect(
        computeGitlabMergeStatus(
          input({
            detailedMergeStatus: 'DRAFT_STATUS',
            conflicts: false,
            headPipelineStatus: 'SUCCESS',
            approvalsLeft: 0,
            resolvableDiscussionsCount: 0,
            resolvedDiscussionsCount: 0,
          }),
        ),
      ).toEqual({ state: 'unknown', reasons: [] });
    });
  });
});
