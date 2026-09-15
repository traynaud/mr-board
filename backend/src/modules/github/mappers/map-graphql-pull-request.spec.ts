import {
  GithubGraphqlActorNode,
  GithubGraphqlPullRequestNode,
} from '../types/github-pull-request.js';
import {
  mapGraphqlActor,
  mapGraphqlPullRequest,
} from './map-graphql-pull-request.js';

const actor = (
  overrides: Partial<GithubGraphqlActorNode> = {},
): GithubGraphqlActorNode => ({
  __typename: 'User',
  login: 'kbenali',
  avatarUrl: 'https://avatars.githubusercontent.com/kbenali',
  url: 'https://github.com/kbenali',
  name: 'Karim Benali',
  ...overrides,
});

const node = (
  overrides: Partial<GithubGraphqlPullRequestNode> = {},
): GithubGraphqlPullRequestNode => ({
  id: 'PR_kwDOABC123',
  number: 42,
  title: 'Add the widget',
  url: 'https://github.com/equipe/front-web/pull/42',
  isDraft: false,
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-02T00:00:00Z',
  comments: { totalCount: 4 },
  reviewThreads: { totalCount: 3 },
  latestOpinionatedReviews: { nodes: [] },
  changedFiles: 7,
  additions: 200,
  deletions: 60,
  labels: { nodes: [{ name: 'wip' }] },
  author: actor(),
  assignees: { nodes: [] },
  reviewRequests: { nodes: [] },
  mergeable: 'MERGEABLE',
  mergeStateStatus: 'CLEAN',
  reviewDecision: null,
  commits: { nodes: [] },
  ...overrides,
});

describe('mapGraphqlActor', () => {
  it('should_map_a_user_with_its_name', () => {
    expect(mapGraphqlActor(actor())).toEqual({
      remoteUserId: 'kbenali',
      username: 'kbenali',
      name: 'Karim Benali',
      avatarUrl: 'https://avatars.githubusercontent.com/kbenali',
      webUrl: 'https://github.com/kbenali',
    });
  });

  it('should_fall_back_to_the_login_when_a_user_has_no_name', () => {
    expect(mapGraphqlActor(actor({ name: null }))).toEqual(
      expect.objectContaining({ name: 'kbenali' }),
    );
  });

  it('should_prefix_the_remote_id_and_use_the_login_as_name_for_a_bot', () => {
    expect(
      mapGraphqlActor(
        actor({ __typename: 'Bot', login: 'dependabot', name: undefined }),
      ),
    ).toEqual({
      remoteUserId: 'bot:dependabot',
      username: 'dependabot',
      name: 'dependabot',
      avatarUrl: 'https://avatars.githubusercontent.com/kbenali',
      webUrl: 'https://github.com/kbenali',
    });
  });
});

describe('mapGraphqlPullRequest', () => {
  it('should_map_every_field_of_the_specs_scenario', () => {
    const result = mapGraphqlPullRequest(
      node({ author: actor({ name: null }) }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        remoteId: 'PR_kwDOABC123',
        iid: 42,
        title: 'Add the widget',
        webUrl: 'https://github.com/equipe/front-web/pull/42',
        draft: false,
        commentsCount: 7,
        changedFiles: 7,
        additions: 200,
        deletions: 60,
        labels: ['wip'],
        author: expect.objectContaining({ name: 'kbenali' }) as unknown,
      }),
    );
  });

  it('should_compute_approved_independently_of_review_decision', () => {
    const result = mapGraphqlPullRequest(
      node({
        reviewDecision: 'REVIEW_REQUIRED',
        latestOpinionatedReviews: {
          nodes: [{ state: 'APPROVED', author: actor({ login: 'mdupont' }) }],
        },
      }),
    );

    expect(result.approved).toBe(true);
  });

  it('should_resolve_reviewers_from_requests_then_already_submitted_reviews', () => {
    const result = mapGraphqlPullRequest(
      node({
        author: actor({ login: 'kbenali' }),
        reviewRequests: {
          nodes: [{ requestedReviewer: actor({ login: 'pmartin' }) }],
        },
        latestOpinionatedReviews: {
          nodes: [{ state: 'APPROVED', author: actor({ login: 'mdupont' }) }],
        },
      }),
    );

    expect(result.reviewers.map((reviewer) => reviewer.username)).toEqual([
      'pmartin',
      'mdupont',
    ]);
  });

  it('should_ignore_a_team_requested_as_reviewer', () => {
    const result = mapGraphqlPullRequest(
      node({
        reviewRequests: {
          nodes: [{ requestedReviewer: { __typename: 'Team' } }],
        },
      }),
    );

    expect(result.reviewers).toEqual([]);
  });

  it('should_skip_a_review_whose_author_was_deleted', () => {
    const result = mapGraphqlPullRequest(
      node({
        latestOpinionatedReviews: {
          nodes: [{ state: 'APPROVED', author: null }],
        },
      }),
    );

    expect(result.reviewers).toEqual([]);
    expect(result.approved).toBe(true);
    // RG-029-01 : l'approbation reste comptée dans `approved`, mais ne peut
    // pas apparaître dans `approvedBy` faute d'identité à afficher.
    expect(result.approvedBy).toEqual([]);
  });

  it('should_expose_the_full_list_and_order_of_approvers_rg_029_01', () => {
    const result = mapGraphqlPullRequest(
      node({
        latestOpinionatedReviews: {
          nodes: [
            { state: 'APPROVED', author: actor({ login: 'kbenali' }) },
            { state: 'CHANGES_REQUESTED', author: actor({ login: 'pmartin' }) },
            { state: 'APPROVED', author: actor({ login: 'lrousseau' }) },
          ],
        },
      }),
    );

    expect(result.approved).toBe(true);
    expect(result.approvedBy.map((user) => user.username)).toEqual([
      'kbenali',
      'lrousseau',
    ]);
  });

  it('should_report_no_approvers_when_nobody_approved', () => {
    const result = mapGraphqlPullRequest(
      node({
        latestOpinionatedReviews: {
          nodes: [
            { state: 'CHANGES_REQUESTED', author: actor({ login: 'pmartin' }) },
          ],
        },
      }),
    );

    expect(result.approved).toBe(false);
    expect(result.approvedBy).toEqual([]);
  });

  it('should_use_the_last_commits_status_check_rollup_for_the_merge_status', () => {
    const result = mapGraphqlPullRequest(
      node({
        mergeable: 'CONFLICTING',
        commits: {
          nodes: [{ commit: { statusCheckRollup: { state: 'FAILURE' } } }],
        },
      }),
    );

    expect(result.mergeStatus).toEqual({
      state: 'blocked',
      reasons: [{ code: 'conflicts' }, { code: 'pipeline_failed' }],
    });
  });

  it('should_treat_a_missing_status_check_rollup_as_no_pipeline', () => {
    const result = mapGraphqlPullRequest(
      node({ commits: { nodes: [{ commit: { statusCheckRollup: null } }] } }),
    );

    expect(result.mergeStatus).toEqual({ state: 'mergeable', reasons: [] });
  });

  it('should_map_the_labels_in_order', () => {
    const result = mapGraphqlPullRequest(
      node({ labels: { nodes: [{ name: 'wip' }, { name: 'backend' }] } }),
    );

    expect(result.labels).toEqual(['wip', 'backend']);
  });

  it('should_map_assignees_in_github_order', () => {
    const result = mapGraphqlPullRequest(
      node({
        assignees: {
          nodes: [actor({ login: 'a' }), actor({ login: 'b' })],
        },
      }),
    );

    expect(result.assignees.map((assignee) => assignee.username)).toEqual([
      'a',
      'b',
    ]);
  });
});
