import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { ForgeMergeRequest } from '../src/modules/forges/types/forge-merge-request.js';
import { GitlabClientService } from '../src/modules/gitlab/gitlab-client.service.js';
import { normalizeGitlabUrl } from '../src/modules/gitlab/domain/normalize-gitlab-url.js';
import { normalizeProjectPath } from '../src/modules/projects/domain/normalize-project-path.js';
import { createTestApp } from './utils/create-test-app.js';

interface StatusBody {
  running: boolean;
}
interface ViewBody {
  id: number;
  iid: number;
  change: 'new' | 'modified' | null;
}

function forgeMergeRequest(
  iid: number,
  overrides: Partial<ForgeMergeRequest> = {},
): ForgeMergeRequest {
  return {
    remoteId: String(iid * 100),
    iid,
    title: `MR ${iid}`,
    webUrl: `https://gitlab.com/-/merge_requests/${iid}`,
    draft: false,
    // Recent: events older than the retention are purged (US-036).
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 86_400_000).toISOString(),
    commentsCount: 0,
    approved: false,
    labels: [],
    changedFiles: 1,
    additions: 1,
    deletions: 0,
    author: {
      remoteUserId: '1',
      username: 'mdupont',
      name: 'Marie Dupont',
      avatarUrl: null,
      webUrl: 'https://gitlab.com/mdupont',
    },
    reviewers: [],
    assignees: [],
    approvedBy: [],
    mergeStatus: { state: 'mergeable', reasons: [] },
    ...overrides,
  };
}

describe('Change highlight (e2e, US-043)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const gitlab = {
    normalizeUrl: jest.fn((url: string) => normalizeGitlabUrl(url)),
    normalizePath: jest.fn((path: string) => normalizeProjectPath(path)),
    testConnection: jest.fn(),
    resolveProject: jest.fn(),
    fetchOpenMergeRequests: jest.fn(),
    fetchMergeRequestEvents: jest.fn(),
    fetchMergeRequestState: jest.fn(),
  };

  beforeAll(async () => {
    app = await createTestApp((b) =>
      b.overrideProvider(GitlabClientService).useValue(gitlab),
    );
    dataSource = app.get(DataSource);
    const api = request(app.getHttpServer());
    await api.post('/api/v1/connections').send({
      type: 'gitlab',
      name: 'GitLab',
      url: 'https://gitlab.com',
      token: 'glpat-highlight-e2e-token',
    });
    gitlab.resolveProject.mockResolvedValueOnce({
      remoteProjectId: '4242',
      pathWithNamespace: 'equipe/api',
      webUrl: 'https://gitlab.com/equipe/api',
    });
    await api
      .post('/api/v1/projects')
      .send({ path: 'equipe/api', alias: 'api' });
  });

  afterAll(async () => {
    await app.close();
  });

  async function sync(mergeRequests: ForgeMergeRequest[]): Promise<void> {
    gitlab.fetchOpenMergeRequests.mockResolvedValue(mergeRequests);
    await request(app.getHttpServer()).post('/api/v1/sync').expect(202);
    for (let i = 0; i < 100; i += 1) {
      const res = await request(app.getHttpServer()).get('/api/v1/sync/status');
      if (!(res.body as StatusBody).running) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('sync never became idle');
  }

  const changes = async (): Promise<Record<number, ViewBody['change']>> => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/merge-requests')
      .expect(200);
    const { mergeRequests } = res.body as { mergeRequests: ViewBody[] };
    return Object.fromEntries(mergeRequests.map((mr) => [mr.iid, mr.change]));
  };
  const idOf = async (iid: number): Promise<number> => {
    const res = await request(app.getHttpServer()).get(
      '/api/v1/merge-requests',
    );
    const { mergeRequests } = res.body as { mergeRequests: ViewBody[] };
    return mergeRequests.find((mr) => mr.iid === iid)!.id;
  };

  it('should_highlight_nothing_after_the_baseline_synchronisation', async () => {
    await sync([forgeMergeRequest(1), forgeMergeRequest(2)]);

    expect(await changes()).toEqual({ 1: null, 2: null });
  });

  it('should_flag_a_new_and_a_modified_merge_request', async () => {
    await sync([
      forgeMergeRequest(1, { title: 'MR 1 renamed' }),
      forgeMergeRequest(2),
      forgeMergeRequest(3),
    ]);

    expect(await changes()).toEqual({ 1: 'modified', 2: null, 3: 'new' });
  });

  it('should_keep_new_when_a_new_merge_request_is_modified_afterwards', async () => {
    await sync([
      forgeMergeRequest(1, { title: 'MR 1 renamed' }),
      forgeMergeRequest(2),
      forgeMergeRequest(3, { title: 'MR 3 renamed' }),
    ]);

    expect(await changes()).toEqual({ 1: 'modified', 2: null, 3: 'new' });
  });

  it('should_ignore_the_notification_preferences', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/settings')
      .send({ notifDisabledTypes: ['title_changed', 'created'] })
      .expect(200);

    expect(await changes()).toEqual({ 1: 'modified', 2: null, 3: 'new' });
  });

  it('should_clear_the_highlight_of_one_merge_request_and_only_its_own_events', async () => {
    const id = await idOf(1);
    await request(app.getHttpServer())
      .post(`/api/v1/merge-requests/${id}/seen`)
      .expect(204);

    expect(await changes()).toEqual({ 1: null, 2: null, 3: 'new' });
    const unseen = await dataSource.query<{ mr_iid: number }[]>(
      `SELECT DISTINCT mr_iid FROM merge_request_events WHERE dismissed_at IS NULL`,
    );
    expect(unseen.map((row) => row.mr_iid)).toEqual([3]);
  });

  it('should_be_idempotent_and_answer_404_for_an_unknown_merge_request', async () => {
    const id = await idOf(1);
    await request(app.getHttpServer())
      .post(`/api/v1/merge-requests/${id}/seen`)
      .expect(204);
    await request(app.getHttpServer())
      .post('/api/v1/merge-requests/99999/seen')
      .expect(404);
    await request(app.getHttpServer())
      .post('/api/v1/merge-requests/abc/seen')
      .expect(400);
  });

  it('should_clear_the_highlight_when_the_notification_is_dismissed', async () => {
    // « Tout marquer comme vu » ne ferme que les événements éligibles aux préférences.
    await request(app.getHttpServer())
      .put('/api/v1/settings')
      .send({ notifDisabledTypes: [] })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/notifications/dismiss-all')
      .expect(200);

    expect(await changes()).toEqual({ 1: null, 2: null, 3: null });
  });

  it('should_store_the_highlight_changes_setting_and_default_to_enabled', async () => {
    const initial = await request(app.getHttpServer()).get('/api/v1/settings');
    expect(
      (initial.body as { highlightChanges: boolean }).highlightChanges,
    ).toBe(true);
    const res = await request(app.getHttpServer())
      .put('/api/v1/settings')
      .send({ highlightChanges: false })
      .expect(200);
    expect((res.body as { highlightChanges: boolean }).highlightChanges).toBe(
      false,
    );
  });
});
