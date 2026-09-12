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
    expect(res.body).toEqual([]);
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
      const [view] = res.body as MergeRequestViewBody[];

      expect(view).toEqual({
        id: expect.any(Number) as number,
        projectAlias: 'api',
        iid: 1,
        title: 'MR 1',
        webUrl: 'https://gitlab.com/equipe/api/-/merge_requests/1',
        draft: false,
        author: { username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
        reviewers: [
          { username: 'kbenali', name: 'Karim Benali', avatarUrl: null },
        ],
        assignees: [
          { username: 'lrousseau', name: 'Léa Rousseau', avatarUrl: null },
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
      const view = (res.body as MergeRequestViewBody[]).find(
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
    const [view] = res.body as MergeRequestViewBody[];
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
    const [view] = res.body as MergeRequestViewBody[];
    expect(view.changedFiles).toBe(0);
    expect(view.changedLines).toBe(0);
    expect(view.difficulty).toBe('easy');
  });

  it('GET /merge-requests should_exclude_draft_merge_requests', async () => {
    gitlab.getOpenMergeRequests.mockResolvedValue([
      rawNode(1),
      rawNode(2, { draft: true }),
    ]);

    await api().post('/api/v1/sync');
    await waitUntilIdle();

    const res = await api().get('/api/v1/merge-requests');
    const iids = (res.body as MergeRequestViewBody[]).map((v) => v.iid);
    expect(iids).toEqual([1]);
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
    const iids = (res.body as MergeRequestViewBody[]).map((v) => v.iid);
    expect(iids).toEqual([1, 3, 5]);
  });
});
