import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { ForgeUnavailableException } from '../src/common/exceptions/index.js';
import { ForgeMergeRequestEvent } from '../src/modules/forges/types/forge-merge-request-event.js';
import { HistoryEnrichmentService } from '../src/modules/history/history-enrichment.service.js';
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

describe('History detection (e2e, US-033)', () => {
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
  let projectId: number;
  let enrichment: HistoryEnrichmentService;

  beforeAll(async () => {
    app = await createTestApp((b) =>
      b.overrideProvider(GitlabClientService).useValue(gitlab),
    );
    dataSource = app.get(DataSource);
    enrichment = app.get(HistoryEnrichmentService);
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

  const actor = (username: string) => ({
    username,
    name: username,
    avatarUrl: null,
  });
  const forgeEvent = (
    overrides: Partial<ForgeMergeRequestEvent>,
  ): ForgeMergeRequestEvent => ({
    sourceEventId: 'note:1:0',
    type: 'title_changed',
    occurredAt: '2026-11-09T10:00:00Z',
    actor: actor('alice'),
    oldValue: null,
    newValue: null,
    ...overrides,
  });

  it('should_confirm_provisional_events_create_the_missing_ones_and_empty_the_queue_when_the_worker_runs', async () => {
    gitlab.fetchMergeRequestEvents.mockImplementation(
      (_u: string, _t: string, _p: unknown, iid: number) =>
        Promise.resolve(
          iid === 1
            ? [
                forgeEvent({ sourceEventId: 'note:10:0' }),
                forgeEvent({
                  sourceEventId: 'note:13:0',
                  actor: actor('erin'),
                  occurredAt: '2026-11-09T10:04:00Z',
                }),
                forgeEvent({
                  sourceEventId: 'note:11:0',
                  type: 'marked_draft',
                  actor: actor('bob'),
                  occurredAt: '2026-11-09T10:01:00Z',
                }),
                forgeEvent({
                  sourceEventId: 'label:3',
                  type: 'label_added',
                  newValue: '"bug"',
                  actor: actor('carol'),
                  occurredAt: '2026-11-09T10:02:00Z',
                }),
                forgeEvent({
                  sourceEventId: 'note:12',
                  type: 'commented',
                  newValue: '"LGTM"',
                  actor: actor('dave'),
                  occurredAt: '2026-11-09T10:03:00Z',
                }),
              ]
            : [],
        ),
    );

    const handled = await enrichment.processDue();

    expect(handled).toBe(3);
    expect(await queue()).toEqual([]);
    const mr1 = (await events()).filter((e) => e.mr_iid === 1);
    const byType = (type: string) => mr1.find((e) => e.type === type);
    const titles = mr1.filter((e) => e.type === 'title_changed');
    expect(titles.map((e) => [e.status, e.actor_username])).toEqual([
      ['confirmed', 'alice'],
      ['confirmed', 'erin'],
    ]);
    expect(titles[0]).toMatchObject({
      old_value: '"MR 1"',
      new_value: '"MR 1 renamed"',
    });
    expect(byType('marked_draft')).toMatchObject({
      status: 'confirmed',
      actor_username: 'bob',
    });
    expect(byType('label_added')).toMatchObject({
      status: 'confirmed',
      actor_username: 'carol',
    });
    expect(byType('commented')).toMatchObject({
      status: 'confirmed',
      actor_username: 'dave',
      new_value: '"LGTM"',
      mr_title: expect.any(String) as string,
      project_alias: 'api',
    });
    expect(mr1.filter((e) => e.status === 'provisional')).toEqual([]);
  });

  it('should_not_duplicate_events_when_the_same_forge_events_are_processed_again', async () => {
    const before = (await events()).length;
    await dataSource.query(
      `INSERT INTO history_queue (project_id, mr_iid, mr_title, mr_web_url, requested_at, attempts)
       VALUES (?, 1, 'MR 1 renamed twice', 'https://gitlab.com/-/merge_requests/1', ?, 0)`,
      [projectId, new Date().toISOString()],
    );
    gitlab.fetchMergeRequestEvents.mockResolvedValue([
      forgeEvent({
        sourceEventId: 'note:12',
        type: 'commented',
        newValue: '"LGTM"',
      }),
    ]);

    await enrichment.processDue();

    expect((await events()).length).toBe(before);
    expect(await queue()).toEqual([]);
  });

  it('should_keep_events_provisional_and_schedule_a_retry_when_the_forge_fails', async () => {
    await sync([
      forgeMergeRequest(1, {
        title: 'MR 1 renamed twice',
        draft: true,
        labels: ['bug'],
      }),
      forgeMergeRequest(2, { commentsCount: 4 }),
      forgeMergeRequest(3, { title: 'MR 3 renamed' }),
    ]);
    gitlab.fetchMergeRequestEvents.mockRejectedValue(
      new ForgeUnavailableException(),
    );

    await enrichment.processDue();

    const [entry] = await dataSource.query<
      { mr_iid: number; attempts: number; next_attempt_at: string }[]
    >(`SELECT * FROM history_queue`);
    expect(entry).toMatchObject({ mr_iid: 3, attempts: 1 });
    expect(new Date(entry?.next_attempt_at ?? 0).getTime()).toBeGreaterThan(
      Date.now(),
    );
    const mr3 = (await events()).filter(
      (e) => e.mr_iid === 3 && e.type === 'title_changed',
    );
    expect(mr3).toEqual([
      expect.objectContaining({ status: 'provisional', actor_username: null }),
    ]);
  });

  it('should_not_retry_an_entry_before_its_next_attempt_date', async () => {
    gitlab.fetchMergeRequestEvents.mockClear();

    await expect(enrichment.processDue()).resolves.toBe(0);
    expect(gitlab.fetchMergeRequestEvents).not.toHaveBeenCalled();
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

  it('should_queue_the_vanished_mrs_as_disappeared_entries', async () => {
    const entries = await dataSource.query<{ mr_iid: number; kind: string }[]>(
      `SELECT mr_iid, kind FROM history_queue ORDER BY mr_iid`,
    );

    expect(entries.map((e) => [e.mr_iid, e.kind])).toEqual([
      [1, 'disappeared'],
      [3, 'disappeared'],
    ]);
  });

  it('should_journal_merged_and_deleted_events_with_the_forge_state_of_the_vanished_mrs', async () => {
    gitlab.fetchMergeRequestEvents.mockResolvedValue([]);
    gitlab.fetchMergeRequestState.mockImplementation(
      (_u: string, _t: string, _p: unknown, iid: number) =>
        Promise.resolve(
          iid === 1
            ? {
                state: 'merged',
                occurredAt: '2026-11-10T07:03:00Z',
                actor: actor('bob'),
              }
            : null,
        ),
    );

    await enrichment.processDue();

    expect(await queue()).toEqual([]);
    const all = await events();
    expect(
      all.find((e) => e.mr_iid === 1 && e.type === 'merged'),
    ).toMatchObject({
      status: 'confirmed',
      actor_username: 'bob',
      occurred_at: '2026-11-10T07:03:00Z',
      old_value: '"opened"',
      new_value: '"merged"',
      mr_title: 'MR 1 renamed twice',
      project_alias: 'api',
    });
    expect(
      all.find((e) => e.mr_iid === 3 && e.type === 'deleted'),
    ).toMatchObject({ status: 'confirmed', actor_username: null });
  });

  it('should_journal_a_reopened_event_instead_of_created_when_a_merged_mr_comes_back', async () => {
    await sync([
      forgeMergeRequest(1),
      forgeMergeRequest(2, { commentsCount: 4 }),
    ]);

    const mr1 = (await events()).filter((e) => e.mr_iid === 1);
    expect(mr1.filter((e) => e.type === 'created')).toEqual([]);
    expect(mr1.find((e) => e.type === 'reopened')).toMatchObject({
      status: 'provisional',
      old_value: '"merged"',
      new_value: '"opened"',
    });
  });

  async function insertEvents(
    count: number,
    occurredAt: (i: number) => string,
  ) {
    for (let i = 0; i < count; i += 1) {
      await dataSource.query(
        `INSERT INTO merge_request_events (occurred_at, detected_at, type, status, connection_id, project_id, mr_iid, mr_title, mr_web_url, project_alias)
         VALUES (?, ?, 'label_added', 'confirmed', 1, ?, 2, 'MR 2', 'https://gitlab.com/-/merge_requests/2', 'api')`,
        [occurredAt(i), occurredAt(i), projectId],
      );
    }
  }
  const count = async () =>
    (
      await dataSource.query<{ n: number }[]>(
        `SELECT COUNT(*) AS n FROM merge_request_events`,
      )
    )[0]?.n ?? 0;

  it('should_purge_events_older_than_the_retention_when_the_settings_are_saved_rg_036_04', async () => {
    const old = new Date(Date.now() - 45 * 86_400_000).toISOString();
    await insertEvents(1, () => old);
    const before = await count();

    await request(app.getHttpServer())
      .put('/api/v1/settings')
      .send({ historyRetentionDays: 30 })
      .expect(200);

    expect(await count()).toBe(before - 1);
    const remaining = await dataSource.query<{ n: number }[]>(
      `SELECT COUNT(*) AS n FROM merge_request_events WHERE occurred_at = ?`,
      [old],
    );
    expect(remaining[0]?.n).toBe(0);
  });

  it('should_keep_only_the_most_recent_events_when_the_maximum_is_lowered_rg_036_02', async () => {
    const base = Date.now() - 3_600_000;
    await insertEvents(150, (i) => new Date(base + i * 1000).toISOString());

    await request(app.getHttpServer())
      .put('/api/v1/settings')
      .send({ historyMaxEvents: 100 })
      .expect(200);

    expect(await count()).toBe(100);
    const kept = await dataSource.query<{ occurred_at: string }[]>(
      `SELECT occurred_at FROM merge_request_events WHERE occurred_at IN (?, ?)`,
      [new Date(base).toISOString(), new Date(base + 149 * 1000).toISOString()],
    );
    expect(kept.map((row) => row.occurred_at)).toEqual([
      new Date(base + 149 * 1000).toISOString(),
    ]);
  });

  it('should_apply_the_retention_at_the_end_of_a_synchronisation_rg_036_04', async () => {
    await insertEvents(5, (i) =>
      new Date(Date.now() + 60_000 + i).toISOString(),
    );
    expect(await count()).toBeGreaterThan(100);

    await sync([
      forgeMergeRequest(1),
      forgeMergeRequest(2, { commentsCount: 4 }),
    ]);

    expect(await count()).toBeLessThanOrEqual(100);
  });

  it('should_delete_the_history_and_the_queue_with_the_project', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/projects/${projectId}`)
      .expect(204);

    expect(await events()).toEqual([]);
    expect(await queue()).toEqual([]);
  });
});
