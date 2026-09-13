import {
  GitlabGraphqlMergeRequestNode,
  GitlabGraphqlUserNode,
} from '../types/gitlab-merge-request';
import {
  extractNumericId,
  mapGraphqlMergeRequest,
  mapGraphqlUser,
} from './map-graphql-merge-request';

function buildUser(id: string, username: string): GitlabGraphqlUserNode {
  return {
    id,
    username,
    name: `Name ${username}`,
    avatarUrl: `https://gitlab.example.com/${username}.png`,
    webUrl: `https://gitlab.example.com/${username}`,
  };
}

function buildMergeRequest(
  overrides: Partial<GitlabGraphqlMergeRequestNode> = {},
): GitlabGraphqlMergeRequestNode {
  return {
    id: 'gid://gitlab/MergeRequest/123',
    iid: '7',
    title: 'Refonte du module de facturation',
    webUrl: 'https://gitlab.example.com/equipe/api/-/merge_requests/7',
    draft: false,
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-05T09:00:00Z',
    userNotesCount: 3,
    approved: true,
    labels: { nodes: [{ title: 'backend' }, { title: 'urgent' }] },
    diffStatsSummary: { fileCount: 12, additions: 340, deletions: 58 },
    author: buildUser('gid://gitlab/User/1', 'mdupont'),
    reviewers: {
      nodes: [
        buildUser('gid://gitlab/User/2', 'kbenali'),
        buildUser('gid://gitlab/User/3', 'lrousseau'),
      ],
    },
    assignees: { nodes: [buildUser('gid://gitlab/User/2', 'kbenali')] },
    detailedMergeStatus: 'MERGEABLE',
    conflicts: false,
    headPipeline: { status: 'SUCCESS' },
    approvalsRequired: 0,
    approvalsLeft: 0,
    resolvableDiscussionsCount: 0,
    resolvedDiscussionsCount: 0,
    ...overrides,
  };
}

describe('extractNumericId', () => {
  it('should_extract_trailing_digits_from_a_global_id', () => {
    expect(extractNumericId('gid://gitlab/MergeRequest/123')).toBe(123);
  });

  it('should_throw_on_a_malformed_global_id', () => {
    expect(() => extractNumericId('not-a-gid')).toThrow();
  });
});

describe('mapGraphqlUser', () => {
  it('should_map_a_user_node', () => {
    expect(
      mapGraphqlUser(buildUser('gid://gitlab/User/42', 'mdupont')),
    ).toEqual({
      gitlabUserId: 42,
      username: 'mdupont',
      name: 'Name mdupont',
      avatarUrl: 'https://gitlab.example.com/mdupont.png',
      webUrl: 'https://gitlab.example.com/mdupont',
    });
  });
});

describe('mapGraphqlMergeRequest', () => {
  it('should_map_a_full_merge_request_node', () => {
    const mapped = mapGraphqlMergeRequest(buildMergeRequest());

    expect(mapped).toEqual({
      gitlabMrId: 123,
      iid: 7,
      title: 'Refonte du module de facturation',
      webUrl: 'https://gitlab.example.com/equipe/api/-/merge_requests/7',
      draft: false,
      createdAt: '2026-09-01T10:00:00Z',
      updatedAt: '2026-09-05T09:00:00Z',
      commentsCount: 3,
      approved: true,
      labels: ['backend', 'urgent'],
      changedFiles: 12,
      additions: 340,
      deletions: 58,
      author: {
        gitlabUserId: 1,
        username: 'mdupont',
        name: 'Name mdupont',
        avatarUrl: 'https://gitlab.example.com/mdupont.png',
        webUrl: 'https://gitlab.example.com/mdupont',
      },
      reviewers: [
        expect.objectContaining({ username: 'kbenali' }),
        expect.objectContaining({ username: 'lrousseau' }),
      ],
      assignees: [expect.objectContaining({ username: 'kbenali' })],
      detailedMergeStatus: 'MERGEABLE',
      conflicts: false,
      headPipelineStatus: 'SUCCESS',
      approvalsRequired: 0,
      approvalsLeft: 0,
      resolvableDiscussionsCount: 0,
      resolvedDiscussionsCount: 0,
    });
  });

  it('should_map_a_null_head_pipeline_status_when_there_is_no_pipeline', () => {
    // US-017, RG-017-04 (`pipeline_missing`) : distingue "pas de pipeline"
    // d'un statut de pipeline connu — ne jamais substituer une valeur.
    const mapped = mapGraphqlMergeRequest(
      buildMergeRequest({ headPipeline: null }),
    );
    expect(mapped.headPipelineStatus).toBeNull();
  });

  it('should_return_null_diff_stats_when_summary_is_absent', () => {
    // RG-006-02 : préserve la distinction entre "0 fichier modifié" (un vrai
    // zéro) et "statistiques indisponibles" — ne jamais remplacer par 0.
    const mapped = mapGraphqlMergeRequest(
      buildMergeRequest({ diffStatsSummary: null }),
    );
    expect(mapped.changedFiles).toBeNull();
    expect(mapped.additions).toBeNull();
    expect(mapped.deletions).toBeNull();
  });

  it('should_map_a_merge_request_with_no_reviewer_or_assignee', () => {
    const mapped = mapGraphqlMergeRequest(
      buildMergeRequest({
        reviewers: { nodes: [] },
        assignees: { nodes: [] },
      }),
    );
    expect(mapped.reviewers).toEqual([]);
    expect(mapped.assignees).toEqual([]);
  });
});
