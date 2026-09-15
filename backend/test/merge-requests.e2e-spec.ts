import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { computeGitlabMergeStatus } from '../src/modules/gitlab/mappers/compute-gitlab-merge-status.js';
import { GitlabClientService } from '../src/modules/gitlab/gitlab-client.service.js';
import { ForgeMergeRequest } from '../src/modules/forges/types/forge-merge-request.js';
import { ForgeUser } from '../src/modules/forges/types/forge-user.js';
import { normalizeGitlabUrl } from '../src/modules/gitlab/domain/normalize-gitlab-url.js';
import { normalizeProjectPath } from '../src/modules/projects/domain/normalize-project-path.js';
import { createTestApp } from './utils/create-test-app.js';

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
  labels: string[];
  author: MergeRequestUserBody;
  reviewers: MergeRequestUserBody[];
  assignees: MergeRequestUserBody[];
  approved: boolean;
  approvedBy: MergeRequestUserBody[];
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
  isFavorite: boolean;
  mergeStatus: {
    state: 'mergeable' | 'blocked' | 'unknown';
    reasons: { code: string; count?: number }[];
  };
  connection: { id: number; name: string; type: string };
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
  connection: FacetOptionBody[];
  project: FacetOptionBody[];
  author: FacetOptionBody[];
  assigned: FacetOptionBody[];
  approved: FacetOptionBody[];
  commented: FacetOptionBody[];
  label: FacetOptionBody[];
}

function forgeUser(
  id: number,
  username: string,
  overrides: Partial<{ name: string; avatarUrl: string | null }> = {},
): ForgeUser {
  return {
    remoteUserId: String(id),
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

/** Raw GitLab-shaped signals a test wants to control ; mapped here exactly as `GitlabClientService.fetchOpenMergeRequests` would, since the client itself is mocked away. */
interface RawOverrides {
  title?: string;
  draft?: boolean;
  createdAt?: string;
  author?: ForgeUser;
  reviewers?: ForgeUser[];
  assignees?: ForgeUser[];
  approved?: boolean;
  approvedBy?: ForgeUser[];
  commentsCount?: number;
  diffStats?: {
    fileCount: number;
    additions: number;
    deletions: number;
  } | null;
  detailedMergeStatus?: string;
  conflicts?: boolean;
  headPipelineStatus?: string | null;
  approvalsLeft?: number;
  labels?: string[];
}

function mergeRequest(
  iid: number,
  overrides: RawOverrides = {},
): ForgeMergeRequest {
  const diffStats =
    overrides.diffStats !== undefined
      ? overrides.diffStats
      : { fileCount: 1, additions: 1, deletions: 0 };
  return {
    remoteId: String(iid * 100),
    iid,
    title: overrides.title ?? `MR ${iid}`,
    webUrl: `https://gitlab.com/equipe/api/-/merge_requests/${iid}`,
    draft: overrides.draft ?? false,
    createdAt: overrides.createdAt ?? `2026-09-0${iid}T10:00:00Z`,
    updatedAt: overrides.createdAt ?? `2026-09-0${iid}T10:00:00Z`,
    commentsCount: overrides.commentsCount ?? iid,
    approved: overrides.approved ?? false,
    labels: overrides.labels ?? [],
    changedFiles: diffStats?.fileCount ?? null,
    additions: diffStats?.additions ?? null,
    deletions: diffStats?.deletions ?? null,
    author:
      overrides.author ?? forgeUser(1, 'mdupont', { name: 'Marie Dupont' }),
    reviewers: overrides.reviewers ?? [],
    assignees: overrides.assignees ?? [],
    approvedBy: overrides.approvedBy ?? [],
    mergeStatus: computeGitlabMergeStatus({
      detailedMergeStatus: overrides.detailedMergeStatus ?? 'MERGEABLE',
      conflicts: overrides.conflicts ?? false,
      headPipelineStatus:
        overrides.headPipelineStatus !== undefined
          ? overrides.headPipelineStatus
          : 'SUCCESS',
      approvalsLeft: overrides.approvalsLeft ?? 0,
      resolvableDiscussionsCount: 0,
      resolvedDiscussionsCount: 0,
    }),
  };
}

describe('MergeRequests (e2e)', () => {
  let app: INestApplication<App>;
  let connectionId: number;
  const gitlab = {
    normalizeUrl: jest.fn((url: string) => normalizeGitlabUrl(url)),
    normalizePath: jest.fn((path: string) => normalizeProjectPath(path)),
    testConnection: jest.fn(),
    resolveProject: jest.fn(),
    fetchOpenMergeRequests: jest.fn(),
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
    gitlab.normalizeUrl.mockImplementation((url: string) =>
      normalizeGitlabUrl(url),
    );
  });

  it('GET /merge-requests should_be_empty_before_any_synchronisation', async () => {
    const res = await api().get('/api/v1/merge-requests');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ mergeRequests: [], warnings: [] });
  });

  it('setup: should_configure_a_connection_and_a_repo_for_the_rest_of_this_suite', async () => {
    const connection = await api().post('/api/v1/connections').send({
      type: 'gitlab',
      name: 'GitLab',
      url: 'https://gitlab.com',
      token: 'glpat-mr-e2e-token',
    });
    connectionId = (connection.body as { id: number }).id;
    gitlab.resolveProject.mockResolvedValue({
      remoteProjectId: '42',
      pathWithNamespace: 'equipe/api',
      webUrl: 'https://gitlab.com/equipe/api',
    });
    const res = await api()
      .post('/api/v1/projects')
      .send({ path: 'equipe/api', alias: 'api' });

    expect(res.status).toBe(201);
  });

  it('GET /merge-requests should_expose_only_the_fields_in_scope_of_this_us', async () => {
    await withFrozenTime('2026-09-11T08:00:00.000Z', async () => {
      gitlab.fetchOpenMergeRequests.mockResolvedValue([
        mergeRequest(1, {
          approved: true,
          commentsCount: 3,
          reviewers: [forgeUser(2, 'kbenali', { name: 'Karim Benali' })],
          assignees: [forgeUser(3, 'lrousseau', { name: 'Léa Rousseau' })],
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
        labels: [],
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
        approvedBy: [],
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
        isFavorite: false,
        mergeStatus: { state: 'mergeable', reasons: [] },
        connection: {
          id: expect.any(Number) as number,
          name: 'GitLab',
          type: 'gitlab',
        },
      });
      expect(Object.keys(view).sort()).toEqual(
        [
          'id',
          'projectAlias',
          'iid',
          'title',
          'webUrl',
          'draft',
          'labels',
          'author',
          'reviewers',
          'assignees',
          'approved',
          'approvedBy',
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
          'isFavorite',
          'mergeStatus',
          'connection',
        ].sort(),
      );
      expect(JSON.stringify(res.body)).not.toContain('token');
    });
  });

  it('GET /merge-requests should_preserve_the_forge_order_of_reviewers_and_assignees_rg_g06', async () => {
    // 'kbenali' and 'lrousseau' already exist (created by an earlier test in
    // this suite) so they carry a lower internal user id than any brand-new
    // user upserted below — SQLite would sort association rows by that id
    // (ascending) unless the insertion order is explicitly preserved.
    gitlab.fetchOpenMergeRequests.mockResolvedValue([
      mergeRequest(500, {
        reviewers: [
          forgeUser(777, 'zbrand', { name: 'Zoé Brand' }),
          forgeUser(2, 'kbenali', { name: 'Karim Benali' }),
        ],
        assignees: [
          forgeUser(778, 'abrand', { name: 'Amir Brand' }),
          forgeUser(3, 'lrousseau', { name: 'Léa Rousseau' }),
        ],
      }),
    ]);

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests');
    const view = (res.body as MergeRequestsResponseBody).mergeRequests.find(
      (mr) => mr.iid === 500,
    );
    expect(view?.reviewers.map((r) => r.username)).toEqual([
      'zbrand',
      'kbenali',
    ]);
    expect(view?.assignees.map((a) => a.username)).toEqual([
      'abrand',
      'lrousseau',
    ]);
  });

  it('GET /merge-requests should_expose_the_names_of_everyone_who_approved_rg_029_01', async () => {
    gitlab.fetchOpenMergeRequests.mockResolvedValue([
      mergeRequest(501, {
        approved: true,
        approvedBy: [
          forgeUser(2, 'kbenali', { name: 'Karim Benali' }),
          forgeUser(3, 'lrousseau', { name: 'Léa Rousseau' }),
        ],
      }),
    ]);

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests');
    const view = (res.body as MergeRequestsResponseBody).mergeRequests.find(
      (mr) => mr.iid === 501,
    );
    expect(view?.approved).toBe(true);
    expect(view?.approvedBy.map((a) => a.username)).toEqual([
      'kbenali',
      'lrousseau',
    ]);
  });

  it('GET /merge-requests should_expose_no_approver_when_the_merge_request_is_not_approved', async () => {
    gitlab.fetchOpenMergeRequests.mockResolvedValue([
      mergeRequest(502, { approved: false, approvedBy: [] }),
    ]);

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests');
    const view = (res.body as MergeRequestsResponseBody).mergeRequests.find(
      (mr) => mr.iid === 502,
    );
    expect(view?.approved).toBe(false);
    expect(view?.approvedBy).toEqual([]);
  });

  it('GET /merge-requests should_keep_an_approvers_name_after_they_are_removed_from_reviewers_rg_029_01', async () => {
    // Un approbateur reste dans approvedBy même s'il est retiré des
    // reviewers lors d'une synchronisation ultérieure (RG-029-01 :
    // approvedBy est une liste indépendante de reviewers).
    gitlab.fetchOpenMergeRequests.mockResolvedValue([
      mergeRequest(503, {
        reviewers: [forgeUser(2, 'kbenali', { name: 'Karim Benali' })],
        approved: true,
        approvedBy: [forgeUser(2, 'kbenali', { name: 'Karim Benali' })],
      }),
    ]);
    await api().post('/api/v1/sync');
    await waitUntilIdle();

    gitlab.fetchOpenMergeRequests.mockResolvedValue([
      mergeRequest(503, {
        reviewers: [],
        approved: true,
        approvedBy: [forgeUser(2, 'kbenali', { name: 'Karim Benali' })],
      }),
    ]);
    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests');
    const view = (res.body as MergeRequestsResponseBody).mergeRequests.find(
      (mr) => mr.iid === 503,
    );
    expect(view?.reviewers).toEqual([]);
    expect(view?.approvedBy.map((a) => a.username)).toEqual(['kbenali']);
  });

  it('GET /merge-requests should_expose_a_green_ready_level_for_a_merge_request_ready_since_yesterday', async () => {
    await withFrozenTime('2026-09-11T08:00:00.000Z', async () => {
      gitlab.fetchOpenMergeRequests.mockResolvedValue([
        mergeRequest(6, { createdAt: '2026-09-10T08:00:00Z' }),
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
    gitlab.fetchOpenMergeRequests.mockResolvedValue([
      mergeRequest(1, { diffStats: null }),
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
    gitlab.fetchOpenMergeRequests.mockResolvedValue([
      mergeRequest(1, {
        diffStats: { fileCount: 0, additions: 0, deletions: 0 },
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
    gitlab.fetchOpenMergeRequests.mockResolvedValue([
      mergeRequest(1),
      mergeRequest(2, { draft: true }),
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
    gitlab.fetchOpenMergeRequests.mockResolvedValue([
      mergeRequest(20, { draft: false, createdAt: '2026-09-01T10:00:00Z' }),
      mergeRequest(21, { draft: true, createdAt: '2026-09-05T10:00:00Z' }),
      mergeRequest(22, { draft: true, createdAt: '2026-09-03T10:00:00Z' }),
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
    gitlab.fetchOpenMergeRequests.mockResolvedValue([
      mergeRequest(5, { createdAt: '2026-09-05T10:00:00Z' }),
      mergeRequest(1, { createdAt: '2026-09-01T10:00:00Z' }),
      mergeRequest(3, { createdAt: '2026-09-03T10:00:00Z' }),
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
    gitlab.fetchOpenMergeRequests.mockResolvedValue([
      mergeRequest(10, { createdAt: '2026-09-01T10:00:00Z' }),
      mergeRequest(11, { createdAt: '2026-09-03T10:00:00Z' }),
      mergeRequest(12, { createdAt: '2026-09-05T10:00:00Z' }),
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
    gitlab.fetchOpenMergeRequests.mockResolvedValue([
      mergeRequest(1, {
        diffStats: { fileCount: 34, additions: 900, deletions: 340 },
      }),
      mergeRequest(2, {
        diffStats: { fileCount: 1, additions: 1, deletions: 0 },
      }),
      mergeRequest(3, {
        diffStats: { fileCount: 9, additions: 300, deletions: 10 },
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
    gitlab.fetchOpenMergeRequests.mockResolvedValue([
      mergeRequest(1, {
        diffStats: { fileCount: 34, additions: 900, deletions: 340 },
      }),
      mergeRequest(2, {
        diffStats: { fileCount: 1, additions: 1, deletions: 0 },
      }),
      mergeRequest(3, {
        diffStats: { fileCount: 9, additions: 300, deletions: 10 },
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
    gitlab.fetchOpenMergeRequests.mockResolvedValue([
      mergeRequest(30),
      mergeRequest(31),
    ]);

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests?mine=1');
    const body = res.body as MergeRequestsResponseBody;
    expect(body.mergeRequests.map((v) => v.iid)).toEqual([30, 31]);
    expect(body.warnings).toEqual(['identity.missing']);
  });

  it('setup: should_configure_my_identity_for_the_rest_of_this_suite', async () => {
    const res = await api()
      .put('/api/v1/settings')
      .send({ identities: [{ connectionId, username: 'mdupont' }] });

    expect(res.status).toBe(200);
  });

  it('GET /merge-requests?mine=1 should_filter_to_merge_requests_where_i_am_the_author', async () => {
    gitlab.fetchOpenMergeRequests.mockResolvedValue([
      mergeRequest(40, {
        author: forgeUser(1, 'mdupont', { name: 'Marie Dupont' }),
      }),
      mergeRequest(41, {
        author: forgeUser(5, 'jdurand', { name: 'Jean Durand' }),
      }),
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
    gitlab.fetchOpenMergeRequests.mockResolvedValue([
      mergeRequest(50, {
        author: forgeUser(5, 'jdurand', { name: 'Jean Durand' }),
        reviewers: [
          forgeUser(6, 'tgirard', { name: 'Thomas Girard' }),
          forgeUser(1, 'mdupont', { name: 'Marie Dupont' }),
        ],
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
    gitlab.fetchOpenMergeRequests.mockResolvedValue([
      mergeRequest(60, {
        author: forgeUser(1, 'mdupont', { name: 'Marie Dupont' }),
        createdAt: '2026-09-01T10:00:00Z',
      }),
      mergeRequest(61, {
        draft: true,
        author: forgeUser(1, 'mdupont', { name: 'Marie Dupont' }),
        createdAt: '2026-09-02T10:00:00Z',
      }),
      mergeRequest(62, {
        draft: true,
        author: forgeUser(5, 'jdurand', { name: 'Jean Durand' }),
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
    gitlab.resolveProject.mockResolvedValue({
      remoteProjectId: '43',
      pathWithNamespace: 'equipe/web',
      webUrl: 'https://gitlab.com/equipe/web',
    });
    const res = await api()
      .post('/api/v1/projects')
      .send({ path: 'equipe/web', alias: 'web' });

    expect(res.status).toBe(201);
  });

  it('GET /merge-requests?project=... should_only_return_merge_requests_of_the_given_projects', async () => {
    gitlab.fetchOpenMergeRequests.mockImplementation(
      (_url: string, _token: string, project: { pathWithNamespace: string }) =>
        project.pathWithNamespace === 'equipe/api'
          ? Promise.resolve([mergeRequest(70), mergeRequest(71)])
          : Promise.resolve([mergeRequest(72)]),
    );

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests?project=api');
    const iids = (res.body as MergeRequestsResponseBody).mergeRequests
      .map((v) => v.iid)
      .sort((a, b) => a - b);
    expect(iids).toEqual([70, 71]);
  });

  it('GET /merge-requests?connection=... should_only_return_merge_requests_of_the_given_connection_case_insensitively', async () => {
    gitlab.fetchOpenMergeRequests.mockImplementation(
      (_url: string, _token: string, project: { pathWithNamespace: string }) =>
        project.pathWithNamespace === 'equipe/api'
          ? Promise.resolve([mergeRequest(75), mergeRequest(76)])
          : Promise.resolve([]),
    );

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const matching = await api().get(
      '/api/v1/merge-requests?connection=gitlab',
    );
    const matchingIids = (
      matching.body as MergeRequestsResponseBody
    ).mergeRequests
      .map((v) => v.iid)
      .sort((a, b) => a - b);
    expect(matchingIids).toEqual(expect.arrayContaining([75, 76]));

    const unknown = await api().get(
      '/api/v1/merge-requests?connection=inconnue',
    );
    expect(unknown.status).toBe(200);
    expect((unknown.body as MergeRequestsResponseBody).mergeRequests).toEqual(
      [],
    );
  });

  it('GET /merge-requests?assigned=nobody should_return_merge_requests_without_reviewer_or_assignee', async () => {
    gitlab.fetchOpenMergeRequests.mockImplementation(
      (_url: string, _token: string, project: { pathWithNamespace: string }) =>
        project.pathWithNamespace === 'equipe/api'
          ? Promise.resolve([
              mergeRequest(80),
              mergeRequest(81, { reviewers: [forgeUser(2, 'kbenali')] }),
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
    gitlab.fetchOpenMergeRequests.mockImplementation(
      (_url: string, _token: string, project: { pathWithNamespace: string }) =>
        project.pathWithNamespace === 'equipe/api'
          ? Promise.resolve([
              mergeRequest(90, { reviewers: [forgeUser(2, 'kbenali')] }),
              mergeRequest(91, { assignees: [forgeUser(2, 'kbenali')] }),
              mergeRequest(92),
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
    gitlab.fetchOpenMergeRequests.mockImplementation(
      (_url: string, _token: string, project: { pathWithNamespace: string }) =>
        project.pathWithNamespace === 'equipe/api'
          ? Promise.resolve([
              mergeRequest(100, { approved: true }),
              mergeRequest(101, { approved: false }),
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
    gitlab.fetchOpenMergeRequests.mockImplementation(
      (_url: string, _token: string, project: { pathWithNamespace: string }) =>
        project.pathWithNamespace === 'equipe/api'
          ? Promise.resolve([
              mergeRequest(110, { commentsCount: 0 }),
              mergeRequest(111, { commentsCount: 2 }),
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
    gitlab.fetchOpenMergeRequests.mockImplementation(
      (
        _url: string,
        _token: string,
        project: { pathWithNamespace: string },
      ) => {
        if (project.pathWithNamespace === 'equipe/api') {
          return Promise.resolve([
            mergeRequest(120, {
              approved: true,
              author: forgeUser(1, 'mdupont', { name: 'Marie Dupont' }),
            }),
            mergeRequest(121, {
              approved: false,
              author: forgeUser(1, 'mdupont', { name: 'Marie Dupont' }),
            }),
            mergeRequest(122, {
              approved: true,
              author: forgeUser(5, 'jdurand', { name: 'Jean Durand' }),
            }),
          ]);
        }
        return Promise.resolve([
          mergeRequest(123, {
            approved: true,
            author: forgeUser(1, 'mdupont', { name: 'Marie Dupont' }),
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
    gitlab.fetchOpenMergeRequests.mockImplementation(
      (_url: string, _token: string, project: { pathWithNamespace: string }) =>
        project.pathWithNamespace === 'equipe/api'
          ? Promise.resolve([mergeRequest(130)])
          : Promise.resolve([]),
    );

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests?project=inconnu');

    expect(res.status).toBe(200);
    expect((res.body as MergeRequestsResponseBody).mergeRequests).toEqual([]);
  });

  it('GET /merge-requests?q=... should_filter_by_a_title_search_case_and_accent_insensitively_rg_026', async () => {
    gitlab.fetchOpenMergeRequests.mockImplementation(
      (_url: string, _token: string, project: { pathWithNamespace: string }) =>
        project.pathWithNamespace === 'equipe/api'
          ? Promise.resolve([
              mergeRequest(140, { title: 'Réfacto du module Paiement' }),
              mergeRequest(141, { title: 'Correctif export CSV' }),
            ])
          : Promise.resolve([]),
    );

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get(
      '/api/v1/merge-requests?q=' + encodeURIComponent('REFACTO paiement'),
    );

    expect(res.status).toBe(200);
    expect(
      (res.body as MergeRequestsResponseBody).mergeRequests.map((v) => v.iid),
    ).toEqual([140]);
  });

  it('GET /merge-requests?q=!iid should_match_a_merge_request_by_its_number_rg_026_05', async () => {
    gitlab.fetchOpenMergeRequests.mockImplementation(
      (_url: string, _token: string, project: { pathWithNamespace: string }) =>
        project.pathWithNamespace === 'equipe/api'
          ? Promise.resolve([
              mergeRequest(142, { title: 'Correctif export CSV' }),
              mergeRequest(143, { title: 'Autre correctif' }),
            ])
          : Promise.resolve([]),
    );

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests?q=!142');

    expect(res.status).toBe(200);
    expect(
      (res.body as MergeRequestsResponseBody).mergeRequests.map((v) => v.iid),
    ).toEqual([142]);
  });

  it('GET /merge-requests?q=... should_combine_with_other_active_filters_with_and_rg_026_06', async () => {
    gitlab.fetchOpenMergeRequests.mockImplementation(
      (_url: string, _token: string, project: { pathWithNamespace: string }) =>
        project.pathWithNamespace === 'equipe/api'
          ? Promise.resolve([
              mergeRequest(144, {
                title: 'Refonte facturation',
                author: forgeUser(1, 'mdupont', { name: 'Marie Dupont' }),
              }),
              mergeRequest(145, {
                title: 'Refonte export',
                author: forgeUser(2, 'kbenali', { name: 'Karim Benali' }),
              }),
            ])
          : Promise.resolve([]),
    );

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get(
      '/api/v1/merge-requests?q=refonte&author=mdupont',
    );

    expect(res.status).toBe(200);
    expect(
      (res.body as MergeRequestsResponseBody).mergeRequests.map((v) => v.iid),
    ).toEqual([144]);
  });

  it('GET /merge-requests?q=... should_not_reveal_a_hidden_draft_matching_the_search_rg_026_06', async () => {
    gitlab.fetchOpenMergeRequests.mockImplementation(
      (_url: string, _token: string, project: { pathWithNamespace: string }) =>
        project.pathWithNamespace === 'equipe/api'
          ? Promise.resolve([
              mergeRequest(149, { title: 'Facturation express' }),
              mergeRequest(150, {
                title: 'Facturation brouillon',
                draft: true,
              }),
            ])
          : Promise.resolve([]),
    );

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests?q=facturation');

    expect(res.status).toBe(200);
    expect(
      (res.body as MergeRequestsResponseBody).mergeRequests.map((v) => v.iid),
    ).toEqual([149]);
  });

  it('GET /merge-requests?q=...&drafts=1 should_apply_the_search_to_displayed_drafts_too_rg_026_06', async () => {
    gitlab.fetchOpenMergeRequests.mockImplementation(
      (_url: string, _token: string, project: { pathWithNamespace: string }) =>
        project.pathWithNamespace === 'equipe/api'
          ? Promise.resolve([
              mergeRequest(151, { title: 'Facturation express' }),
              mergeRequest(152, {
                title: 'Facturation brouillon',
                draft: true,
              }),
              mergeRequest(153, { title: 'Correctif export CSV', draft: true }),
            ])
          : Promise.resolve([]),
    );

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get(
      '/api/v1/merge-requests?q=facturation&drafts=1',
    );

    expect(res.status).toBe(200);
    // RG-G10 : bloc Ready d'abord, puis le bloc Drafts — l'ordre est préservé
    // même filtré par la recherche.
    expect(
      (res.body as MergeRequestsResponseBody).mergeRequests.map((v) => v.iid),
    ).toEqual([151, 152]);
  });

  it('GET /merge-requests/facets should_scope_facet_counts_to_the_search_rg_026_07', async () => {
    gitlab.fetchOpenMergeRequests.mockImplementation(
      (_url: string, _token: string, project: { pathWithNamespace: string }) =>
        project.pathWithNamespace === 'equipe/api'
          ? Promise.resolve([
              mergeRequest(146, { title: 'Refonte facturation' }),
              mergeRequest(147, { title: 'Correctif export CSV' }),
            ])
          : Promise.resolve([]),
    );

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests/facets?q=facturation');

    expect(res.status).toBe(200);
    const projectFacet = (res.body as MergeRequestsFacetsBody).project;
    expect(projectFacet).toEqual([
      { value: 'api', label: 'api · equipe/api', count: 1 },
      { value: 'web', label: 'web · equipe/web', count: 0 },
    ]);
  });

  it('GET /merge-requests?q=... should_return_an_empty_list_when_nothing_matches', async () => {
    gitlab.fetchOpenMergeRequests.mockImplementation(
      (_url: string, _token: string, project: { pathWithNamespace: string }) =>
        project.pathWithNamespace === 'equipe/api'
          ? Promise.resolve([
              mergeRequest(148, { title: 'Refonte facturation' }),
            ])
          : Promise.resolve([]),
    );

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests?q=zzzzz');

    expect(res.status).toBe(200);
    expect((res.body as MergeRequestsResponseBody).mergeRequests).toEqual([]);
  });

  it('GET /merge-requests/facets should_expose_options_and_contextual_counts_for_the_6_filters', async () => {
    gitlab.fetchOpenMergeRequests.mockImplementation(
      (
        _url: string,
        _token: string,
        project: { pathWithNamespace: string },
      ) => {
        if (project.pathWithNamespace === 'equipe/api') {
          return Promise.resolve([
            mergeRequest(140, {
              author: forgeUser(1, 'mdupont', { name: 'Marie Dupont' }),
              commentsCount: 0,
            }),
            mergeRequest(141, {
              author: forgeUser(1, 'mdupont', { name: 'Marie Dupont' }),
              reviewers: [forgeUser(2, 'kbenali', { name: 'Karim Benali' })],
              commentsCount: 0,
            }),
            mergeRequest(142, {
              author: forgeUser(5, 'jdurand', { name: 'Jean Durand' }),
              approved: true,
              commentsCount: 1,
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

    expect(facets.connection).toEqual([
      { value: 'GitLab', label: 'GitLab', count: 3 },
    ]);
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

  it('GET /merge-requests/facets?connection=inconnue should_not_apply_the_connection_filter_to_its_own_options', async () => {
    const res = await api().get(
      '/api/v1/merge-requests/facets?connection=inconnue',
    );
    expect(res.status).toBe(200);
    const facets = res.body as MergeRequestsFacetsBody;

    // 'connection' ignores its own active filter: 'GitLab' keeps its true count.
    expect(facets.connection).toEqual([
      { value: 'GitLab', label: 'GitLab', count: 3 },
    ]);
    // but 'project' IS scoped by connection=inconnue (no open MR there).
    expect(facets.project.find((o) => o.value === 'api')?.count).toBe(0);
  });

  describe('mergeStatus (US-017)', () => {
    it('GET /merge-requests should_report_a_blocked_merge_status_with_ordered_reasons', async () => {
      gitlab.fetchOpenMergeRequests.mockResolvedValue([
        mergeRequest(200, {
          detailedMergeStatus: 'CONFLICT',
          conflicts: true,
          headPipelineStatus: 'FAILED',
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
      gitlab.fetchOpenMergeRequests.mockResolvedValue([
        mergeRequest(201, { detailedMergeStatus: 'CHECKING' }),
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
      gitlab.fetchOpenMergeRequests.mockResolvedValue([
        mergeRequest(202, {
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

  describe('labels (US-028)', () => {
    it('GET /merge-requests should_expose_the_labels_field_rg_028_01', async () => {
      gitlab.fetchOpenMergeRequests.mockResolvedValue([
        mergeRequest(400, { labels: ['bug', 'urgent'] }),
      ]);
      await api().post('/api/v1/sync');
      await waitUntilIdle();

      const res = await api().get('/api/v1/merge-requests');
      const view = (res.body as MergeRequestsResponseBody).mergeRequests.find(
        (mr) => mr.iid === 400,
      );
      expect(view?.labels).toEqual(['bug', 'urgent']);
    });

    it('GET /merge-requests?label=... should_filter_by_a_single_label_rg_028_11', async () => {
      gitlab.fetchOpenMergeRequests.mockImplementation(
        (
          _url: string,
          _token: string,
          project: { pathWithNamespace: string },
        ) =>
          project.pathWithNamespace === 'equipe/api'
            ? Promise.resolve([
                mergeRequest(410, { labels: ['bug'] }),
                mergeRequest(411, { labels: ['urgent'] }),
              ])
            : Promise.resolve([]),
      );
      await api().post('/api/v1/sync');
      await waitUntilIdle();

      const res = await api().get('/api/v1/merge-requests?label=bug');
      const iids = (res.body as MergeRequestsResponseBody).mergeRequests.map(
        (v) => v.iid,
      );
      expect(iids).toEqual([410]);
    });

    it('GET /merge-requests?label=... should_combine_several_labels_with_or_rg_028_11', async () => {
      gitlab.fetchOpenMergeRequests.mockImplementation(
        (
          _url: string,
          _token: string,
          project: { pathWithNamespace: string },
        ) =>
          project.pathWithNamespace === 'equipe/api'
            ? Promise.resolve([
                mergeRequest(420, { labels: ['bug'] }),
                mergeRequest(421, { labels: ['urgent'] }),
                mergeRequest(422, { labels: ['backend'] }),
              ])
            : Promise.resolve([]),
      );
      await api().post('/api/v1/sync');
      await waitUntilIdle();

      const res = await api().get('/api/v1/merge-requests?label=bug,urgent');
      const iids = (res.body as MergeRequestsResponseBody).mergeRequests
        .map((v) => v.iid)
        .sort((a, b) => a - b);
      expect(iids).toEqual([420, 421]);
    });

    it('GET /merge-requests?label=none should_filter_merge_requests_without_any_label_rg_028_13', async () => {
      gitlab.fetchOpenMergeRequests.mockImplementation(
        (
          _url: string,
          _token: string,
          project: { pathWithNamespace: string },
        ) =>
          project.pathWithNamespace === 'equipe/api'
            ? Promise.resolve([
                mergeRequest(430, { labels: [] }),
                mergeRequest(431, { labels: ['bug'] }),
              ])
            : Promise.resolve([]),
      );
      await api().post('/api/v1/sync');
      await waitUntilIdle();

      const res = await api().get('/api/v1/merge-requests?label=none');
      const iids = (res.body as MergeRequestsResponseBody).mergeRequests.map(
        (v) => v.iid,
      );
      expect(iids).toEqual([430]);
    });

    it('GET /merge-requests?project=...&label=... should_combine_with_another_composable_filter_with_and_rg_028_11', async () => {
      gitlab.fetchOpenMergeRequests.mockImplementation(
        (
          _url: string,
          _token: string,
          project: { pathWithNamespace: string },
        ) =>
          project.pathWithNamespace === 'equipe/api'
            ? Promise.resolve([mergeRequest(440, { labels: ['bug'] })])
            : Promise.resolve([mergeRequest(441, { labels: ['bug'] })]),
      );
      await api().post('/api/v1/sync');
      await waitUntilIdle();

      const res = await api().get(
        '/api/v1/merge-requests?project=api&label=bug',
      );
      const iids = (res.body as MergeRequestsResponseBody).mergeRequests.map(
        (v) => v.iid,
      );
      expect(iids).toEqual([440]);
    });

    it('GET /merge-requests/facets should_expose_distinct_labels_with_none_first_rg_028_12_13', async () => {
      gitlab.fetchOpenMergeRequests.mockImplementation(
        (
          _url: string,
          _token: string,
          project: { pathWithNamespace: string },
        ) =>
          project.pathWithNamespace === 'equipe/api'
            ? Promise.resolve([
                mergeRequest(450, { labels: ['bug'] }),
                mergeRequest(451, { labels: [] }),
              ])
            : Promise.resolve([]),
      );
      await api().post('/api/v1/sync');
      await waitUntilIdle();

      const res = await api().get('/api/v1/merge-requests/facets');
      const facets = res.body as MergeRequestsFacetsBody;
      expect(facets.label[0]).toEqual({
        value: 'none',
        label: 'Sans label',
        count: expect.any(Number) as number,
      });
      expect(
        facets.label.find((o) => o.value === 'bug')?.count,
      ).toBeGreaterThanOrEqual(1);
    });

    it('should_never_expose_an_ignored_label_in_the_column_or_the_filter_options_rg_028_04', async () => {
      await api()
        .put('/api/v1/settings')
        .send({ ignoredLabels: ['wip'] });
      gitlab.fetchOpenMergeRequests.mockImplementation(
        (
          _url: string,
          _token: string,
          project: { pathWithNamespace: string },
        ) =>
          project.pathWithNamespace === 'equipe/api'
            ? Promise.resolve([
                mergeRequest(460, { labels: ['wip', 'backend'] }),
                mergeRequest(461, { labels: ['backend'] }),
              ])
            : Promise.resolve([]),
      );
      await api().post('/api/v1/sync');
      await waitUntilIdle();

      const res = await api().get('/api/v1/merge-requests');
      const iids = (res.body as MergeRequestsResponseBody).mergeRequests.map(
        (v) => v.iid,
      );
      expect(iids).not.toContain(460);

      const facets = await api().get('/api/v1/merge-requests/facets');
      expect(
        (facets.body as MergeRequestsFacetsBody).label.some(
          (o) => o.value === 'wip',
        ),
      ).toBe(false);

      // Reset for subsequent tests in this suite.
      await api().put('/api/v1/settings').send({ ignoredLabels: [] });
    });
  });

  describe('favorites (US-027)', () => {
    it('PUT /merge-requests/:id/favorite should_mark_a_merge_request_as_favorite_rg_027_08', async () => {
      gitlab.fetchOpenMergeRequests.mockResolvedValue([mergeRequest(300)]);
      await api().post('/api/v1/sync');
      await waitUntilIdle();
      const listed = await api().get('/api/v1/merge-requests');
      const id = (listed.body as MergeRequestsResponseBody).mergeRequests.find(
        (mr: MergeRequestViewBody) => mr.iid === 300,
      )!.id;

      const putRes = await api().put(`/api/v1/merge-requests/${id}/favorite`);
      expect(putRes.status).toBe(204);

      const res = await api().get('/api/v1/merge-requests');
      const view = (res.body as MergeRequestsResponseBody).mergeRequests.find(
        (mr) => mr.iid === 300,
      );
      expect(view?.isFavorite).toBe(true);
    });

    it('DELETE /merge-requests/:id/favorite should_unmark_a_merge_request_as_favorite_rg_027_08', async () => {
      gitlab.fetchOpenMergeRequests.mockResolvedValue([mergeRequest(301)]);
      await api().post('/api/v1/sync');
      await waitUntilIdle();
      const listed = await api().get('/api/v1/merge-requests');
      const id = (listed.body as MergeRequestsResponseBody).mergeRequests.find(
        (mr: MergeRequestViewBody) => mr.iid === 301,
      )!.id;
      await api().put(`/api/v1/merge-requests/${id}/favorite`);

      const deleteRes = await api().delete(
        `/api/v1/merge-requests/${id}/favorite`,
      );
      expect(deleteRes.status).toBe(204);

      const res = await api().get('/api/v1/merge-requests');
      const view = (res.body as MergeRequestsResponseBody).mergeRequests.find(
        (mr) => mr.iid === 301,
      );
      expect(view?.isFavorite).toBe(false);
    });

    it('PUT /merge-requests/:id/favorite should_respond_404_for_an_unknown_merge_request_id', async () => {
      const res = await api().put('/api/v1/merge-requests/999999/favorite');

      expect(res.status).toBe(404);
    });

    it('GET /merge-requests?fav=1 should_only_return_favorited_merge_requests_rg_027_10', async () => {
      gitlab.fetchOpenMergeRequests.mockResolvedValue([
        mergeRequest(310),
        mergeRequest(311),
      ]);
      await api().post('/api/v1/sync');
      await waitUntilIdle();
      const listed = await api().get('/api/v1/merge-requests');
      const id = (listed.body as MergeRequestsResponseBody).mergeRequests.find(
        (mr: MergeRequestViewBody) => mr.iid === 310,
      )!.id;
      await api().put(`/api/v1/merge-requests/${id}/favorite`);

      const res = await api().get('/api/v1/merge-requests?fav=1');
      const iids = (res.body as MergeRequestsResponseBody).mergeRequests.map(
        (v) => v.iid,
      );
      expect(iids).toEqual([310]);
    });

    it('GET /merge-requests?fav=1&drafts=1 should_keep_a_favorited_draft_hidden_unless_drafts_are_included_rg_027_13', async () => {
      gitlab.fetchOpenMergeRequests.mockResolvedValue([
        mergeRequest(320, { draft: true }),
      ]);
      await api().post('/api/v1/sync');
      await waitUntilIdle();
      const listed = await api().get('/api/v1/merge-requests?drafts=1');
      const id = (listed.body as MergeRequestsResponseBody).mergeRequests.find(
        (mr: MergeRequestViewBody) => mr.iid === 320,
      )!.id;
      await api().put(`/api/v1/merge-requests/${id}/favorite`);

      const hidden = await api().get('/api/v1/merge-requests?fav=1');
      expect((hidden.body as MergeRequestsResponseBody).mergeRequests).toEqual(
        [],
      );

      const shown = await api().get('/api/v1/merge-requests?fav=1&drafts=1');
      expect(
        (shown.body as MergeRequestsResponseBody).mergeRequests.map(
          (v) => v.iid,
        ),
      ).toEqual([320]);
    });

    it('GET /settings/export should_include_a_favorite_resolved_to_its_connection_and_repo_path_rg_027_15', async () => {
      gitlab.fetchOpenMergeRequests.mockResolvedValue([mergeRequest(330)]);
      await api().post('/api/v1/sync');
      await waitUntilIdle();
      const listed = await api().get('/api/v1/merge-requests');
      const id = (listed.body as MergeRequestsResponseBody).mergeRequests.find(
        (mr: MergeRequestViewBody) => mr.iid === 330,
      )!.id;
      await api().put(`/api/v1/merge-requests/${id}/favorite`);

      const res = await api().get('/api/v1/settings/export');

      expect((res.body as { favorites: unknown[] }).favorites).toEqual(
        expect.arrayContaining([
          { connection: 'GitLab', pathWithNamespace: 'equipe/api', iid: 330 },
        ]),
      );
    });

    it('GET /merge-requests?fav=1&project=... should_combine_favorites_with_a_composable_filter_rg_027_10', async () => {
      gitlab.fetchOpenMergeRequests.mockImplementation(
        (
          _url: string,
          _token: string,
          project: { pathWithNamespace: string },
        ) =>
          project.pathWithNamespace === 'equipe/api'
            ? Promise.resolve([mergeRequest(350)])
            : Promise.resolve([mergeRequest(351)]),
      );
      await api().post('/api/v1/sync');
      await waitUntilIdle();
      const listed = await api().get('/api/v1/merge-requests');
      const mergeRequests = (listed.body as MergeRequestsResponseBody)
        .mergeRequests;
      const apiMrId = mergeRequests.find((mr) => mr.iid === 350)!.id;
      const webMrId = mergeRequests.find((mr) => mr.iid === 351)!.id;
      await api().put(`/api/v1/merge-requests/${apiMrId}/favorite`);
      await api().put(`/api/v1/merge-requests/${webMrId}/favorite`);

      const res = await api().get('/api/v1/merge-requests?fav=1&project=api');
      const iids = (res.body as MergeRequestsResponseBody).mergeRequests.map(
        (v) => v.iid,
      );
      expect(iids).toEqual([350]);
    });

    it('should_keep_a_favorite_across_its_merge_requests_disappearance_and_reappearance_rg_027_04', async () => {
      const onlyOnApi =
        (mr: ReturnType<typeof mergeRequest> | null) =>
        (
          _url: string,
          _token: string,
          project: { pathWithNamespace: string },
        ) =>
          project.pathWithNamespace === 'equipe/api' && mr
            ? Promise.resolve([mr])
            : Promise.resolve([]);

      gitlab.fetchOpenMergeRequests.mockImplementation(
        onlyOnApi(mergeRequest(340)),
      );
      await api().post('/api/v1/sync');
      await waitUntilIdle();
      const firstSync = await api().get('/api/v1/merge-requests');
      const firstId = (
        firstSync.body as MergeRequestsResponseBody
      ).mergeRequests.find((mr) => mr.iid === 340)!.id;
      await api().put(`/api/v1/merge-requests/${firstId}/favorite`);

      // RG-004-03 : la MR disparaît de la réponse de la forge (fermée) —
      // `deleteMissing` retire sa ligne, le favori (table distincte) survit.
      gitlab.fetchOpenMergeRequests.mockImplementation(onlyOnApi(null));
      await api().post('/api/v1/sync');
      await waitUntilIdle();
      const disappeared = await api().get('/api/v1/merge-requests');
      expect(
        (disappeared.body as MergeRequestsResponseBody).mergeRequests.some(
          (v) => v.iid === 340,
        ),
      ).toBe(false);

      // Elle réapparaît : l'upsert crée une NOUVELLE ligne, avec un nouvel id
      // interne — RG-027-04 exige que le favori la retrouve quand même.
      gitlab.fetchOpenMergeRequests.mockImplementation(
        onlyOnApi(mergeRequest(340)),
      );
      await api().post('/api/v1/sync');
      await waitUntilIdle();
      const reappeared = await api().get('/api/v1/merge-requests');
      const secondView = (
        reappeared.body as MergeRequestsResponseBody
      ).mergeRequests.find((mr) => mr.iid === 340);
      expect(secondView?.id).not.toBe(firstId);
      expect(secondView?.isFavorite).toBe(true);
    });

    it('DELETE /projects/:id should_purge_its_favorites_rg_027_05', async () => {
      gitlab.fetchOpenMergeRequests.mockImplementation(
        (
          _url: string,
          _token: string,
          project: { pathWithNamespace: string },
        ) =>
          project.pathWithNamespace === 'equipe/api'
            ? Promise.resolve([mergeRequest(360)])
            : Promise.resolve([]),
      );
      await api().post('/api/v1/sync');
      await waitUntilIdle();
      const listed = await api().get('/api/v1/merge-requests');
      const id = (listed.body as MergeRequestsResponseBody).mergeRequests.find(
        (mr) => mr.iid === 360,
      )!.id;
      await api().put(`/api/v1/merge-requests/${id}/favorite`);

      const projects = await api().get('/api/v1/projects');
      const apiProjectId = (
        projects.body as { id: number; alias: string }[]
      ).find((p) => p.alias === 'api')!.id;

      const deleteRes = await api().delete(`/api/v1/projects/${apiProjectId}`);
      expect(deleteRes.status).toBe(204);

      const exportRes = await api().get('/api/v1/settings/export');
      const remainingApiFavorites = (
        exportRes.body as { favorites: { pathWithNamespace: string }[] }
      ).favorites.filter((f) => f.pathWithNamespace === 'equipe/api');
      expect(remainingApiFavorites).toEqual([]);
    });
  });
});
