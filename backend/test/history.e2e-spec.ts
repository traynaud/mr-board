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
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-01T10:00:00Z',
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

describe('History detection (e2e, US-033)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const gitlab = {
    normalizeUrl: jest.fn((url: string) => normalizeGitlabUrl(url)),
    normalizePath: jest.fn((path: string) => normalizeProjectPath(path)),
    testConnection: jest.fn(),
    resolveProject: jest.fn(),
    fetchOpenMergeRequests: jest.fn(),
  };
  let projectId: number;

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
      token: 'glpat-history-e2e-token',
    });
    gitlab.resolveProject.mockResolvedValueOnce({
      remoteProjectId: '4242',
      pathWithNamespace: 'equipe/api',
      webUrl: 'https://gitlab.com/equipe/api',
    });
    const res = await api
      .post('/api/v1/projects')
      .send({ path: 'equipe/api', alias: 'api' });
    projectId = (res.body as { id: number }).id;
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

  const events = () =>
    dataSource.query<
      {
        type: string;
        status: string;
        actor_username: string | null;
        old_value: string | null;
        new_value: string | null;
        mr_iid: number;
        project_alias: string;
        mr_title: string;
      }[]
    >(`SELECT * FROM merge_request_events ORDER BY id`);
  const queue = () =>
    dataSource.query<{ mr_iid: number; mr_title: string }[]>(
      `SELECT * FROM history_queue ORDER BY mr_iid`,
    );

  it('should_journal_nothing_on_the_first_synchronisation_of_a_project', async () => {
    await sync([forgeMergeRequest(1), forgeMergeRequest(2)]);

    expect(await events()).toEqual([]);
    expect(await queue()).toEqual([]);
  });

  it('should_journal_nothing_when_nothing_changed', async () => {
    await sync([forgeMergeRequest(1), forgeMergeRequest(2)]);

    expect(await events()).toEqual([]);
    expect(await queue()).toEqual([]);
  });

  it('should_create_provisional_events_and_queue_the_mr_when_it_changes', async () => {
    await sync([
      forgeMergeRequest(1, {
        title: 'MR 1 renamed',
        draft: true,
        labels: ['bug'],
      }),
      forgeMergeRequest(2),
    ]);

    const rows = await events();
    expect(rows.map((r) => r.type)).toEqual([
      'title_changed',
      'marked_draft',
      'label_added',
    ]);
    expect(rows[0]).toMatchObject({
      status: 'provisional',
      actor_username: null,
      mr_iid: 1,
      project_alias: 'api',
      mr_title: 'MR 1 renamed',
      old_value: '"MR 1"',
      new_value: '"MR 1 renamed"',
    });
    expect(await queue()).toEqual([
      expect.objectContaining({ mr_iid: 1, mr_title: 'MR 1 renamed' }),
    ]);
  });

  it('should_keep_a_single_queue_entry_per_mr_when_it_changes_again', async () => {
    await sync([
      forgeMergeRequest(1, {
        title: 'MR 1 renamed twice',
        draft: true,
        labels: ['bug'],
      }),
      forgeMergeRequest(2),
    ]);

    const queued = await queue();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ mr_title: 'MR 1 renamed twice' });
  });

  it('should_emit_created_for_a_new_mr_and_queue_it', async () => {
    await sync([
      forgeMergeRequest(1, {
        title: 'MR 1 renamed twice',
        draft: true,
        labels: ['bug'],
      }),
      forgeMergeRequest(2),
      forgeMergeRequest(3),
    ]);

    const created = (await events()).filter((r) => r.type === 'created');
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ mr_iid: 3, new_value: '"MR 3"' });
    expect((await queue()).map((q) => q.mr_iid)).toEqual([1, 3]);
  });

  it('should_queue_without_event_when_only_the_comment_count_grows', async () => {
    const before = (await events()).length;
    await sync([
      forgeMergeRequest(1, {
        title: 'MR 1 renamed twice',
        draft: true,
        labels: ['bug'],
      }),
      forgeMergeRequest(2, { commentsCount: 4 }),
      forgeMergeRequest(3),
    ]);

    expect((await events()).length).toBe(before);
    expect((await queue()).map((q) => q.mr_iid)).toEqual([1, 2, 3]);
  });

  it('should_keep_the_journal_when_a_merge_request_disappears_from_the_board', async () => {
    const before = (await events()).length;
    await sync([forgeMergeRequest(2, { commentsCount: 4 })]);

    expect((await events()).length).toBe(before);
    const rows = await dataSource.query<{ n: number }[]>(
      `SELECT COUNT(*) AS n FROM merge_request_events WHERE mr_iid = 1`,
    );
    expect(rows[0]?.n).toBeGreaterThan(0);
  });

  it('should_delete_the_history_and_the_queue_with_the_project', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/projects/${projectId}`)
      .expect(204);

    expect(await events()).toEqual([]);
    expect(await queue()).toEqual([]);
  });
});
