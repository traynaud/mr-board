import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { GitlabClientService } from '../src/modules/gitlab/gitlab-client.service';
import { GitlabGraphqlMergeRequestNode } from '../src/modules/gitlab/types/gitlab-merge-request';
import { createTestApp } from './utils/create-test-app';

interface MergeRequestUserBody {
  username: string;
  name: string;
  avatarUrl: string | null;
  isMe: boolean;
}
interface MergeRequestViewBody {
  id: number;
  projectAlias: string;
  iid: number;
  title: string;
  webUrl: string;
  draft: boolean;
  author: MergeRequestUserBody;
  reviewers: MergeRequestUserBody[];
  assignees: MergeRequestUserBody[];
  approved: boolean;
  commentsCount: number;
  difficulty: 'easy' | 'medium' | 'hard';
  changedFiles: number | null;
  additions: number | null;
  deletions: number | null;
  changedLines: number | null;
  createdAt: string;
  readyAt: string | null;
  readyDays: number | null;
  readyLevel: 'green' | 'orange' | 'red' | null;
  openedDays: number;
  isMine: boolean;
  mergeStatus: {
    state: 'mergeable' | 'blocked' | 'unknown';
    reasons: { code: string; count?: number }[];
  };
}
interface MergeRequestsResponseBody {
  mergeRequests: MergeRequestViewBody[];
  warnings: string[];
}
interface FacetOptionBody {
  value: string;
  label: string;
  count: number;
}
interface MergeRequestsFacetsBody {
  project: FacetOptionBody[];
  author: FacetOptionBody[];
  assigned: FacetOptionBody[];
  approved: FacetOptionBody[];
  commented: FacetOptionBody[];
}

function userNode(
  id: number,
  username: string,
  overrides: Partial<{ name: string; avatarUrl: string | null }> = {},
) {
  return {
    id: `gid://gitlab/User/${id}`,
    username,
    name: overrides.name ?? `Name ${username}`,
    avatarUrl: overrides.avatarUrl ?? null,
    webUrl: `https://gitlab.com/${username}`,
  };
}

/**
 * Freezes `Date`/`Date.now()` to `iso` for the duration of `fn`, keeping
 * every timer function real (`setTimeout`/`setInterval`…) so it doesn't
 * block `waitUntilIdle` or the sync scheduler — only "now" is deterministic.
 */
async function withFrozenTime<T>(
  iso: string,
  fn: () => Promise<T>,
): Promise<T> {
  jest.useFakeTimers({
    doNotFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'setImmediate',
      'clearImmediate',
      'nextTick',
      'hrtime',
      'performance',
      'queueMicrotask',
    ],
  });
  jest.setSystemTime(new Date(iso));
  try {
    return await fn();
  } finally {
    jest.useRealTimers();
  }
}

function rawNode(
  iid: number,
  overrides: Partial<GitlabGraphqlMergeRequestNode> = {},
): GitlabGraphqlMergeRequestNode {
  return {
    id: `gid://gitlab/MergeRequest/${iid * 100}`,
    iid: String(iid),
    title: `MR ${iid}`,
    webUrl: `https://gitlab.com/equipe/api/-/merge_requests/${iid}`,
    draft: false,
    createdAt: `2026-09-0${iid}T10:00:00Z`,
    updatedAt: `2026-09-0${iid}T10:00:00Z`,
    userNotesCount: iid,
    approved: false,
    labels: { nodes: [] },
    diffStatsSummary: { fileCount: 1, additions: 1, deletions: 0 },
    author: userNode(1, 'mdupont', { name: 'Marie Dupont' }),
    reviewers: { nodes: [] },
    assignees: { nodes: [] },
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

describe('MergeRequests (e2e)', () => {
  let app: INestApplication<App>;
  const gitlab = {
    getCurrentUser: jest.fn(),
    getTokenInfo: jest.fn(),
    getProject: jest.fn(),
    getOpenMergeRequests: jest.fn(),
  };

  beforeAll(async () => {
    app = await createTestApp((b) =>
      b.overrideProvider(GitlabClientService).useValue(gitlab),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  async function waitUntilIdle(): Promise<void> {
    for (let i = 0; i < 50; i += 1) {
      const res = await api().get('/api/v1/sync/status');
      if (!(res.body as { running: boolean }).running) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('sync never became idle');
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /merge-requests should_be_empty_before_any_synchronisation', async () => {
    const res = await api().get('/api/v1/merge-requests');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ mergeRequests: [], warnings: [] });
  });

  it('setup: should_configure_a_token_and_a_repo_for_the_rest_of_this_suite', async () => {
    await api().put('/api/v1/settings').send({
      gitlabUrl: 'https://gitlab.com',
      gitlabToken: 'glpat-mr-e2e-token',
    });
    gitlab.getProject.mockResolvedValue({
      id: 42,
      path_with_namespace: 'equipe/api',
      web_url: 'https://gitlab.com/equipe/api',
    });
    const res = await api()
      .post('/api/v1/projects')
      .send({ path: 'equipe/api', alias: 'api' });

    expect(res.status).toBe(201);
  });

  it('GET /merge-requests should_expose_only_the_fields_in_scope_of_this_us', async () => {
    await withFrozenTime('2026-09-11T08:00:00.000Z', async () => {
      gitlab.getOpenMergeRequests.mockResolvedValue([
        rawNode(1, {
          approved: true,
          userNotesCount: 3,
          reviewers: {
            nodes: [userNode(2, 'kbenali', { name: 'Karim Benali' })],
          },
          assignees: {
            nodes: [userNode(3, 'lrousseau', { name: 'Léa Rousseau' })],
          },
        }),
      ]);

      await api().post('/api/v1/sync');
      await waitUntilIdle();

      const res = await api().get('/api/v1/merge-requests');
      expect(res.status).toBe(200);
      const [view] = (res.body as MergeRequestsResponseBody).mergeRequests;

      expect(view).toEqual({
        id: expect.any(Number) as number,
        projectAlias: 'api',
        iid: 1,
        title: 'MR 1',
        webUrl: 'https://gitlab.com/equipe/api/-/merge_requests/1',
        draft: false,
        author: {
          username: 'mdupont',
          name: 'Marie Dupont',
          avatarUrl: null,
          isMe: false,
        },
        reviewers: [
          {
            username: 'kbenali',
            name: 'Karim Benali',
            avatarUrl: null,
            isMe: false,
          },
        ],
        assignees: [
          {
            username: 'lrousseau',
            name: 'Léa Rousseau',
            avatarUrl: null,
            isMe: false,
          },
        ],
        approved: true,
        commentsCount: 3,
        difficulty: 'easy',
        changedFiles: 1,
        additions: 1,
        deletions: 0,
        changedLines: 1,
        createdAt: '2026-09-01T10:00:00Z',
        readyAt: '2026-09-01T10:00:00Z',
        readyDays: 9,
        readyLevel: 'red',
        openedDays: 9,
        isMine: false,
        mergeStatus: { state: 'mergeable', reasons: [] },
      });
      expect(Object.keys(view).sort()).toEqual(
        [
          'id',
          'projectAlias',
          'iid',
          'title',
          'webUrl',
          'draft',
          'author',
          'reviewers',
          'assignees',
          'approved',
          'commentsCount',
          'difficulty',
          'changedFiles',
          'additions',
          'deletions',
          'changedLines',
          'createdAt',
          'readyAt',
          'readyDays',
          'readyLevel',
          'openedDays',
          'isMine',
          'mergeStatus',
        ].sort(),
      );
      expect(JSON.stringify(res.body)).not.toContain('token');
    });
  });

  it('GET /merge-requests should_expose_a_green_ready_level_for_a_merge_request_ready_since_yesterday', async () => {
    await withFrozenTime('2026-09-11T08:00:00.000Z', async () => {
      gitlab.getOpenMergeRequests.mockResolvedValue([
        rawNode(6, { createdAt: '2026-09-10T08:00:00Z' }),
      ]);

      await api().post('/api/v1/sync');
      await waitUntilIdle();

      const res = await api().get('/api/v1/merge-requests');
      const view = (res.body as MergeRequestsResponseBody).mergeRequests.find(
        (mr) => mr.iid === 6,
      );
      expect(view?.readyDays).toBe(1);
      expect(view?.readyLevel).toBe('green');
      expect(view?.openedDays).toBe(1);
    });
  });

  it('GET /merge-requests should_report_medium_difficulty_and_null_stats_when_unavailable', async () => {
    gitlab.getOpenMergeRequests.mockResolvedValue([
      rawNode(1, { diffStatsSummary: null }),
    ]);

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests');
    const [view] = (res.body as MergeRequestsResponseBody).mergeRequests;
    expect(view.difficulty).toBe('medium');
    expect(view.changedFiles).toBeNull();
    expect(view.additions).toBeNull();
    expect(view.deletions).toBeNull();
    expect(view.changedLines).toBeNull();
  });

  it('GET /merge-requests should_distinguish_a_real_zero_from_unavailable_stats', async () => {
    gitlab.getOpenMergeRequests.mockResolvedValue([
      rawNode(1, {
        diffStatsSummary: { fileCount: 0, additions: 0, deletions: 0 },
      }),
    ]);

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests');
    const [view] = (res.body as MergeRequestsResponseBody).mergeRequests;
    expect(view.changedFiles).toBe(0);
    expect(view.changedLines).toBe(0);
    expect(view.difficulty).toBe('easy');
  });

  it('GET /merge-requests should_exclude_draft_merge_requests_by_default', async () => {
    gitlab.getOpenMergeRequests.mockResolvedValue([
      rawNode(1),
      rawNode(2, { draft: true }),
    ]);

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests');
    const iids = (res.body as MergeRequestsResponseBody).mergeRequests.map(
      (v) => v.iid,
    );
    expect(iids).toEqual([1]);
  });

  it('GET /merge-requests?drafts=1 should_include_drafts_after_ready_sorted_by_created_at_ascending', async () => {
    gitlab.getOpenMergeRequests.mockResolvedValue([
      rawNode(20, { draft: false, createdAt: '2026-09-01T10:00:00Z' }),
      rawNode(21, { draft: true, createdAt: '2026-09-05T10:00:00Z' }),
      rawNode(22, { draft: true, createdAt: '2026-09-03T10:00:00Z' }),
    ]);

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests?drafts=1');
    const { mergeRequests } = res.body as MergeRequestsResponseBody;
    expect(mergeRequests.map((v) => v.iid)).toEqual([20, 22, 21]);
    const draft = mergeRequests.find((v) => v.iid === 21);
    expect(draft?.draft).toBe(true);
    expect(draft?.readyAt).toBeNull();
    expect(draft?.readyDays).toBeNull();
  });

  it('GET /merge-requests should_be_sorted_by_ready_at_ascending', async () => {
    gitlab.getOpenMergeRequests.mockResolvedValue([
      rawNode(5, { createdAt: '2026-09-05T10:00:00Z' }),
      rawNode(1, { createdAt: '2026-09-01T10:00:00Z' }),
      rawNode(3, { createdAt: '2026-09-03T10:00:00Z' }),
    ]);

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests');
    const iids = (res.body as MergeRequestsResponseBody).mergeRequests.map(
      (v) => v.iid,
    );
    expect(iids).toEqual([1, 3, 5]);
  });

  it('GET /merge-requests?sort=ready:desc should_reverse_the_default_order', async () => {
    gitlab.getOpenMergeRequests.mockResolvedValue([
      rawNode(10, { createdAt: '2026-09-01T10:00:00Z' }),
      rawNode(11, { createdAt: '2026-09-03T10:00:00Z' }),
      rawNode(12, { createdAt: '2026-09-05T10:00:00Z' }),
    ]);

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests?sort=ready:desc');
    const iids = (res.body as MergeRequestsResponseBody).mergeRequests.map(
      (v) => v.iid,
    );
    expect(iids).toEqual([12, 11, 10]);
  });

  it('GET /merge-requests?sort=diff:asc should_sort_easy_to_hard', async () => {
    gitlab.getOpenMergeRequests.mockResolvedValue([
      rawNode(1, {
        diffStatsSummary: { fileCount: 34, additions: 900, deletions: 340 },
      }),
      rawNode(2, {
        diffStatsSummary: { fileCount: 1, additions: 1, deletions: 0 },
      }),
      rawNode(3, {
        diffStatsSummary: { fileCount: 9, additions: 300, deletions: 10 },
      }),
    ]);

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests?sort=diff:asc');
    const { mergeRequests } = res.body as MergeRequestsResponseBody;
    expect(mergeRequests.map((v) => v.iid)).toEqual([2, 3, 1]);
    expect(mergeRequests.map((v) => v.difficulty)).toEqual([
      'easy',
      'medium',
      'hard',
    ]);
  });

  it('GET /merge-requests?sort=diff:desc should_sort_hard_to_easy', async () => {
    gitlab.getOpenMergeRequests.mockResolvedValue([
      rawNode(1, {
        diffStatsSummary: { fileCount: 34, additions: 900, deletions: 340 },
      }),
      rawNode(2, {
        diffStatsSummary: { fileCount: 1, additions: 1, deletions: 0 },
      }),
      rawNode(3, {
        diffStatsSummary: { fileCount: 9, additions: 300, deletions: 10 },
      }),
    ]);

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests?sort=diff:desc');
    const iids = (res.body as MergeRequestsResponseBody).mergeRequests.map(
      (v) => v.iid,
    );
    expect(iids).toEqual([1, 3, 2]);
  });

  it('GET /merge-requests?sort=title:asc should_respond_400_for_an_invalid_sort_value', async () => {
    const res = await api().get('/api/v1/merge-requests?sort=title:asc');

    expect(res.status).toBe(400);
  });

  it('GET /merge-requests?mine=1 should_return_everything_and_warn_when_identity_is_not_configured', async () => {
    gitlab.getOpenMergeRequests.mockResolvedValue([rawNode(30), rawNode(31)]);

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests?mine=1');
    const body = res.body as MergeRequestsResponseBody;
    expect(body.mergeRequests.map((v) => v.iid)).toEqual([30, 31]);
    expect(body.warnings).toEqual(['identity.missing']);
  });

  it('setup: should_configure_my_identity_for_the_rest_of_this_suite', async () => {
    const res = await api().put('/api/v1/settings').send({
      gitlabUrl: 'https://gitlab.com',
      meUsername: 'mdupont',
    });

    expect(res.status).toBe(200);
  });

  it('GET /merge-requests?mine=1 should_filter_to_merge_requests_where_i_am_the_author', async () => {
    gitlab.getOpenMergeRequests.mockResolvedValue([
      rawNode(40, { author: userNode(1, 'mdupont', { name: 'Marie Dupont' }) }),
      rawNode(41, { author: userNode(5, 'jdurand', { name: 'Jean Durand' }) }),
    ]);

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests?mine=1');
    const body = res.body as MergeRequestsResponseBody;
    expect(body.mergeRequests.map((v) => v.iid)).toEqual([40]);
    expect(body.mergeRequests[0].isMine).toBe(true);
    expect(body.mergeRequests[0].author.isMe).toBe(true);
    expect(body.warnings).toEqual([]);
  });

  it('GET /merge-requests should_expose_is_mine_true_when_i_am_one_of_several_reviewers', async () => {
    gitlab.getOpenMergeRequests.mockResolvedValue([
      rawNode(50, {
        author: userNode(5, 'jdurand', { name: 'Jean Durand' }),
        reviewers: {
          nodes: [
            userNode(6, 'tgirard', { name: 'Thomas Girard' }),
            userNode(1, 'mdupont', { name: 'Marie Dupont' }),
          ],
        },
      }),
    ]);

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests');
    const view = (res.body as MergeRequestsResponseBody).mergeRequests.find(
      (v) => v.iid === 50,
    );
    expect(view?.isMine).toBe(true);
    expect(view?.reviewers.find((r) => r.username === 'mdupont')?.isMe).toBe(
      true,
    );
    expect(view?.reviewers.find((r) => r.username === 'tgirard')?.isMe).toBe(
      false,
    );
  });

  it('GET /merge-requests?drafts=1&mine=1 should_combine_drafts_and_mine', async () => {
    gitlab.getOpenMergeRequests.mockResolvedValue([
      rawNode(60, {
        author: userNode(1, 'mdupont', { name: 'Marie Dupont' }),
        createdAt: '2026-09-01T10:00:00Z',
      }),
      rawNode(61, {
        draft: true,
        author: userNode(1, 'mdupont', { name: 'Marie Dupont' }),
        createdAt: '2026-09-02T10:00:00Z',
      }),
      rawNode(62, {
        draft: true,
        author: userNode(5, 'jdurand', { name: 'Jean Durand' }),
        createdAt: '2026-09-03T10:00:00Z',
      }),
    ]);

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests?drafts=1&mine=1');
    const iids = (res.body as MergeRequestsResponseBody).mergeRequests.map(
      (v) => v.iid,
    );
    expect(iids).toEqual([60, 61]);
  });

  it('setup: should_configure_a_second_repo_for_the_composable_filters_tests', async () => {
    gitlab.getProject.mockResolvedValue({
      id: 43,
      path_with_namespace: 'equipe/web',
      web_url: 'https://gitlab.com/equipe/web',
    });
    const res = await api()
      .post('/api/v1/projects')
      .send({ path: 'equipe/web', alias: 'web' });

    expect(res.status).toBe(201);
  });

  it('GET /merge-requests?project=... should_only_return_merge_requests_of_the_given_projects', async () => {
    gitlab.getOpenMergeRequests.mockImplementation(
      (_url: string, _token: string, pathWithNamespace: string) =>
        pathWithNamespace === 'equipe/api'
          ? Promise.resolve([rawNode(70), rawNode(71)])
          : Promise.resolve([rawNode(72)]),
    );

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests?project=api');
    const iids = (res.body as MergeRequestsResponseBody).mergeRequests
      .map((v) => v.iid)
      .sort((a, b) => a - b);
    expect(iids).toEqual([70, 71]);
  });

  it('GET /merge-requests?assigned=nobody should_return_merge_requests_without_reviewer_or_assignee', async () => {
    gitlab.getOpenMergeRequests.mockImplementation(
      (_url: string, _token: string, pathWithNamespace: string) =>
        pathWithNamespace === 'equipe/api'
          ? Promise.resolve([
              rawNode(80),
              rawNode(81, {
                reviewers: { nodes: [userNode(2, 'kbenali')] },
              }),
            ])
          : Promise.resolve([]),
    );

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests?assigned=nobody');
    const iids = (res.body as MergeRequestsResponseBody).mergeRequests.map(
      (v) => v.iid,
    );
    expect(iids).toEqual([80]);
  });

  it('GET /merge-requests?assigned=kbenali should_match_either_reviewer_or_assignee_role', async () => {
    gitlab.getOpenMergeRequests.mockImplementation(
      (_url: string, _token: string, pathWithNamespace: string) =>
        pathWithNamespace === 'equipe/api'
          ? Promise.resolve([
              rawNode(90, {
                reviewers: { nodes: [userNode(2, 'kbenali')] },
              }),
              rawNode(91, {
                assignees: { nodes: [userNode(2, 'kbenali')] },
              }),
              rawNode(92),
            ])
          : Promise.resolve([]),
    );

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests?assigned=kbenali');
    const iids = (res.body as MergeRequestsResponseBody).mergeRequests
      .map((v) => v.iid)
      .sort((a, b) => a - b);
    expect(iids).toEqual([90, 91]);
  });

  it('GET /merge-requests?approved=0 should_only_return_unapproved_merge_requests', async () => {
    gitlab.getOpenMergeRequests.mockImplementation(
      (_url: string, _token: string, pathWithNamespace: string) =>
        pathWithNamespace === 'equipe/api'
          ? Promise.resolve([
              rawNode(100, { approved: true }),
              rawNode(101, { approved: false }),
            ])
          : Promise.resolve([]),
    );

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests?approved=0');
    const iids = (res.body as MergeRequestsResponseBody).mergeRequests.map(
      (v) => v.iid,
    );
    expect(iids).toEqual([101]);
  });

  it('GET /merge-requests?commented=1 should_only_return_merge_requests_with_at_least_one_comment', async () => {
    gitlab.getOpenMergeRequests.mockImplementation(
      (_url: string, _token: string, pathWithNamespace: string) =>
        pathWithNamespace === 'equipe/api'
          ? Promise.resolve([
              rawNode(110, { userNotesCount: 0 }),
              rawNode(111, { userNotesCount: 2 }),
            ])
          : Promise.resolve([]),
    );

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests?commented=1');
    const iids = (res.body as MergeRequestsResponseBody).mergeRequests.map(
      (v) => v.iid,
    );
    expect(iids).toEqual([111]);
  });

  it('GET /merge-requests?project=api&approved=1&mine=1 should_combine_all_active_filters_with_and', async () => {
    gitlab.getOpenMergeRequests.mockImplementation(
      (_url: string, _token: string, pathWithNamespace: string) => {
        if (pathWithNamespace === 'equipe/api') {
          return Promise.resolve([
            rawNode(120, {
              approved: true,
              author: userNode(1, 'mdupont', { name: 'Marie Dupont' }),
            }),
            rawNode(121, {
              approved: false,
              author: userNode(1, 'mdupont', { name: 'Marie Dupont' }),
            }),
            rawNode(122, {
              approved: true,
              author: userNode(5, 'jdurand', { name: 'Jean Durand' }),
            }),
          ]);
        }
        return Promise.resolve([
          rawNode(123, {
            approved: true,
            author: userNode(1, 'mdupont', { name: 'Marie Dupont' }),
          }),
        ]);
      },
    );

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get(
      '/api/v1/merge-requests?project=api&approved=1&mine=1',
    );
    const iids = (res.body as MergeRequestsResponseBody).mergeRequests.map(
      (v) => v.iid,
    );
    expect(iids).toEqual([120]);
  });

  it('GET /merge-requests?approved=maybe should_respond_400_for_an_invalid_boolean_filter_value', async () => {
    const res = await api().get('/api/v1/merge-requests?approved=maybe');

    expect(res.status).toBe(400);
  });

  it('GET /merge-requests?project=inconnu should_respond_200_with_an_empty_list_for_an_unknown_project_alias', async () => {
    gitlab.getOpenMergeRequests.mockImplementation(
      (_url: string, _token: string, pathWithNamespace: string) =>
        pathWithNamespace === 'equipe/api'
          ? Promise.resolve([rawNode(130)])
          : Promise.resolve([]),
    );

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests?project=inconnu');

    expect(res.status).toBe(200);
    expect((res.body as MergeRequestsResponseBody).mergeRequests).toEqual([]);
  });

  it('GET /merge-requests/facets should_expose_options_and_contextual_counts_for_the_5_filters', async () => {
    gitlab.getOpenMergeRequests.mockImplementation(
      (_url: string, _token: string, pathWithNamespace: string) => {
        if (pathWithNamespace === 'equipe/api') {
          return Promise.resolve([
            rawNode(140, {
              author: userNode(1, 'mdupont', { name: 'Marie Dupont' }),
              userNotesCount: 0,
            }),
            rawNode(141, {
              author: userNode(1, 'mdupont', { name: 'Marie Dupont' }),
              reviewers: {
                nodes: [userNode(2, 'kbenali', { name: 'Karim Benali' })],
              },
              userNotesCount: 0,
            }),
            rawNode(142, {
              author: userNode(5, 'jdurand', { name: 'Jean Durand' }),
              approved: true,
              userNotesCount: 1,
            }),
          ]);
        }
        return Promise.resolve([]);
      },
    );

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests/facets');
    expect(res.status).toBe(200);
    const facets = res.body as MergeRequestsFacetsBody;

    expect(facets.project.find((o) => o.value === 'api')?.count).toBe(3);
    expect(facets.project.find((o) => o.value === 'web')?.count).toBe(0);
    expect(facets.author).toEqual(
      expect.arrayContaining([
        { value: 'mdupont', label: 'Marie Dupont', count: 2 },
        { value: 'jdurand', label: 'Jean Durand', count: 1 },
      ]),
    );
    expect(facets.assigned[0]).toEqual({
      value: 'nobody',
      label: 'Nobody',
      count: 2,
    });
    expect(facets.approved).toEqual([
      { value: 'yes', label: 'Oui', count: 1 },
      { value: 'no', label: 'Non', count: 2 },
    ]);
    expect(facets.commented).toEqual([
      { value: 'yes', label: 'Oui', count: 1 },
      { value: 'no', label: 'Non', count: 2 },
    ]);
  });

  it('GET /merge-requests/facets?project=web should_not_apply_a_filter_to_its_own_options', async () => {
    const res = await api().get('/api/v1/merge-requests/facets?project=web');
    expect(res.status).toBe(200);
    const facets = res.body as MergeRequestsFacetsBody;

    // 'project' ignores its own active filter: 'api' keeps its true count (3).
    expect(facets.project.find((o) => o.value === 'api')?.count).toBe(3);
    expect(facets.project.find((o) => o.value === 'web')?.count).toBe(0);
    // but 'assigned' IS scoped by project=web (no open MR there).
    expect(facets.assigned[0]).toEqual({
      value: 'nobody',
      label: 'Nobody',
      count: 0,
    });
  });

  describe('mergeStatus (US-017)', () => {
    it('GET /merge-requests should_report_a_blocked_merge_status_with_ordered_reasons', async () => {
      gitlab.getOpenMergeRequests.mockResolvedValue([
        rawNode(200, {
          detailedMergeStatus: 'CONFLICT',
          conflicts: true,
          headPipeline: { status: 'FAILED' },
          approvalsLeft: 2,
        }),
      ]);

      await api().post('/api/v1/sync');
      await waitUntilIdle();

      const res = await api().get('/api/v1/merge-requests');
      const view = (res.body as MergeRequestsResponseBody).mergeRequests.find(
        (mr) => mr.iid === 200,
      );
      expect(view?.mergeStatus).toEqual({
        state: 'blocked',
        reasons: [
          { code: 'conflicts' },
          { code: 'pipeline_failed' },
          { code: 'not_approved', count: 2 },
        ],
      });
    });

    it('GET /merge-requests should_report_an_unknown_merge_status_while_gitlab_is_still_checking', async () => {
      gitlab.getOpenMergeRequests.mockResolvedValue([
        rawNode(201, { detailedMergeStatus: 'CHECKING' }),
      ]);

      await api().post('/api/v1/sync');
      await waitUntilIdle();

      const res = await api().get('/api/v1/merge-requests');
      const view = (res.body as MergeRequestsResponseBody).mergeRequests.find(
        (mr) => mr.iid === 201,
      );
      expect(view?.mergeStatus).toEqual({ state: 'unknown', reasons: [] });
    });

    it('GET /merge-requests should_report_blocked_with_a_single_reason_for_a_draft_with_conflicts', async () => {
      gitlab.getOpenMergeRequests.mockResolvedValue([
        rawNode(202, {
          draft: true,
          detailedMergeStatus: 'DRAFT_STATUS',
          conflicts: true,
        }),
      ]);

      await api().post('/api/v1/sync');
      await waitUntilIdle();

      const res = await api().get('/api/v1/merge-requests?drafts=1');
      const view = (res.body as MergeRequestsResponseBody).mergeRequests.find(
        (mr) => mr.iid === 202,
      );
      expect(view?.mergeStatus).toEqual({
        state: 'blocked',
        reasons: [{ code: 'conflicts' }],
      });
    });
  });
});
