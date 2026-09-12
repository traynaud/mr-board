import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { GitlabClientService } from '../src/modules/gitlab/gitlab-client.service';
import { GitlabGraphqlMergeRequestNode } from '../src/modules/gitlab/types/gitlab-merge-request';
import { createTestApp } from './utils/create-test-app';

interface SyncRunBody {
  status?: string;
  mrCount?: number;
  errorMessage?: string | null;
  trigger?: string;
  startedAt?: string;
}
interface StatusBody {
  running: boolean;
  lastRun: SyncRunBody | null;
  nextRunAt: string | null;
}
interface ProjectBody {
  id: number;
  alias: string;
  pathWithNamespace: string;
}

function rawNode(iid: number): GitlabGraphqlMergeRequestNode {
  return {
    id: `gid://gitlab/MergeRequest/${iid * 100}`,
    iid: String(iid),
    title: `MR ${iid}`,
    webUrl: `https://gitlab.com/-/merge_requests/${iid}`,
    draft: false,
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-01T10:00:00Z',
    userNotesCount: 0,
    approved: false,
    labels: { nodes: [] },
    diffStatsSummary: { fileCount: 1, additions: 1, deletions: 0 },
    author: {
      id: 'gid://gitlab/User/1',
      username: 'mdupont',
      name: 'Marie Dupont',
      avatarUrl: null,
      webUrl: 'https://gitlab.com/mdupont',
    },
    reviewers: { nodes: [] },
    assignees: { nodes: [] },
  };
}

describe('Sync (e2e)', () => {
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

  async function waitUntilIdle(): Promise<StatusBody> {
    for (let i = 0; i < 50; i += 1) {
      const res = await api().get('/api/v1/sync/status');
      const status = res.body as StatusBody;
      if (!status.running) {
        return status;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('sync never became idle');
  }

  async function addProject(path: string, alias: string): Promise<ProjectBody> {
    gitlab.getProject.mockResolvedValueOnce({
      id: Math.floor(Math.random() * 100_000),
      path_with_namespace: path,
      web_url: `https://gitlab.com/${path}`,
    });
    const res = await api().post('/api/v1/projects').send({ path, alias });
    return res.body as ProjectBody;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /sync/status should_report_never_synced_initially', async () => {
    const before = Date.now();
    const res = await api().get('/api/v1/sync/status');
    const after = Date.now();

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ running: false, lastRun: null }),
    );
    // Default refreshIntervalMin is 5 (non-manual) and nothing has ever
    // synced yet: a scheduled sync is immediately due (RG-013-02/07).
    const status = res.body as StatusBody;
    expect(status.nextRunAt).not.toBeNull();
    const nextRunAtTime = new Date(status.nextRunAt as string).getTime();
    expect(nextRunAtTime).toBeGreaterThanOrEqual(before);
    expect(nextRunAtTime).toBeLessThanOrEqual(after);
  });

  it('POST /sync should_report_an_error_run_when_no_token_is_configured', async () => {
    const res = await api().post('/api/v1/sync');

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ running: true });

    const status = await waitUntilIdle();
    expect(status.lastRun).toEqual(
      expect.objectContaining({
        status: 'error',
        errorMessage: 'settings.tokenMissing',
      }),
    );
    expect(gitlab.getOpenMergeRequests).not.toHaveBeenCalled();
  });

  it('PUT /settings should_configure_a_token_for_the_rest_of_this_suite', async () => {
    const res = await api().put('/api/v1/settings').send({
      gitlabUrl: 'https://gitlab.com',
      gitlabToken: 'glpat-sync-e2e-token',
    });

    expect(res.status).toBe(200);
    expect((res.body as { tokenConfigured: boolean }).tokenConfigured).toBe(
      true,
    );
  });

  it('POST /sync should_synchronise_every_active_project_successfully', async () => {
    const api1 = await addProject('equipe/api', 'api');
    const web1 = await addProject('equipe/web', 'web');
    gitlab.getOpenMergeRequests.mockImplementation(
      (_url: string, _token: string, path: string) =>
        Promise.resolve(
          path === api1.pathWithNamespace
            ? [rawNode(1), rawNode(2)]
            : [rawNode(3)],
        ),
    );

    const trigger = await api().post('/api/v1/sync');
    expect(trigger.status).toBe(202);
    expect(trigger.body).toEqual({ running: true });

    const status = await waitUntilIdle();
    expect(status.lastRun).toEqual(
      expect.objectContaining({
        status: 'success',
        mrCount: 3,
        trigger: 'manual',
      }),
    );
    expect(gitlab.getOpenMergeRequests).toHaveBeenCalledWith(
      'https://gitlab.com',
      'glpat-sync-e2e-token',
      'equipe/api',
      expect.anything(),
    );
    expect(gitlab.getOpenMergeRequests).toHaveBeenCalledWith(
      'https://gitlab.com',
      'glpat-sync-e2e-token',
      'equipe/web',
      expect.anything(),
    );
    expect(web1.alias).toBe('web');
  });

  it('POST /sync should_not_start_a_second_run_while_one_is_in_progress', async () => {
    let resolvePending!: (nodes: GitlabGraphqlMergeRequestNode[]) => void;
    gitlab.getOpenMergeRequests.mockReturnValue(
      new Promise((resolve) => {
        resolvePending = resolve;
      }),
    );

    const first = await api().post('/api/v1/sync');
    const second = await api().post('/api/v1/sync');

    expect(first.body).toEqual({ running: true });
    expect(second.body).toEqual({ running: true });

    const midFlight = await api().get('/api/v1/sync/status');
    expect((midFlight.body as StatusBody).running).toBe(true);

    resolvePending([]);
    await waitUntilIdle();
    // Two projects (api, web) but a single run: one call per project, not per POST.
    expect(gitlab.getOpenMergeRequests).toHaveBeenCalledTimes(2);
  });

  it('POST /sync?projectId should_synchronise_only_the_targeted_project', async () => {
    const list = await api().get('/api/v1/projects');
    const apiProject = (list.body as ProjectBody[]).find(
      (p) => p.alias === 'api',
    );
    gitlab.getOpenMergeRequests.mockResolvedValue([rawNode(1)]);

    const res = await api().post(`/api/v1/sync?projectId=${apiProject?.id}`);
    expect(res.status).toBe(202);

    await waitUntilIdle();
    expect(gitlab.getOpenMergeRequests).toHaveBeenCalledTimes(1);
    expect(gitlab.getOpenMergeRequests).toHaveBeenCalledWith(
      'https://gitlab.com',
      'glpat-sync-e2e-token',
      'equipe/api',
      expect.anything(),
    );
  });

  it('POST /sync?projectId should_be_404_for_an_unknown_project', async () => {
    const res = await api().post('/api/v1/sync?projectId=999999');

    expect(res.status).toBe(404);
  });

  it('POST /sync should_report_partial_when_one_project_fails_and_another_succeeds', async () => {
    gitlab.getOpenMergeRequests.mockImplementation(
      (_url: string, _token: string, path: string) =>
        path === 'equipe/api'
          ? Promise.resolve([rawNode(1)])
          : Promise.reject(new Error('GitLab is unavailable')),
    );

    await api().post('/api/v1/sync');
    const status = await waitUntilIdle();

    expect(status.lastRun).toEqual(
      expect.objectContaining({ status: 'partial', mrCount: 1 }),
    );
    expect(status.lastRun?.errorMessage).toContain('web');
  });

  it('POST /sync should_report_error_when_every_project_fails', async () => {
    gitlab.getOpenMergeRequests.mockRejectedValue(
      new Error('GitLab rejected the token (401)'),
    );

    await api().post('/api/v1/sync');
    const status = await waitUntilIdle();

    expect(status.lastRun).toEqual(
      expect.objectContaining({ status: 'error', mrCount: 0 }),
    );
  });

  it('GET /sync/status should_compute_nextRunAt_from_the_configured_interval', async () => {
    await api().put('/api/v1/settings').send({
      gitlabUrl: 'https://gitlab.com',
      refreshIntervalMin: 30,
    });
    gitlab.getOpenMergeRequests.mockResolvedValue([]);

    await api().post('/api/v1/sync');
    const status = await waitUntilIdle();

    expect(status.nextRunAt).toBe(
      new Date(
        new Date(status.lastRun?.startedAt as string).getTime() + 30 * 60_000,
      ).toISOString(),
    );
  });

  it('GET /sync/status should_report_no_next_run_in_manual_mode', async () => {
    await api()
      .put('/api/v1/settings')
      .send({ gitlabUrl: 'https://gitlab.com', refreshIntervalMin: 0 });

    const res = await api().get('/api/v1/sync/status');

    expect(res.body).toEqual(expect.objectContaining({ nextRunAt: null }));
  });
});
