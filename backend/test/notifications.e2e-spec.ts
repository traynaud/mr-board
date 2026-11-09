import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/create-test-app.js';

interface NotificationsBody {
  events: { id: number; type: string; status: string }[];
  count: number;
  revision: string;
}

describe('Notifications (e2e, US-039/040/041)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let connectionId: number;
  let projectId: number;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    await request(app.getHttpServer()).post('/api/v1/connections').send({
      type: 'gitlab',
      name: 'GitLab',
      url: 'https://gitlab.com',
      token: 'glpat-notifications-e2e-token',
    });
    await dataSource.query(
      `UPDATE connections SET resolved_username = 'me', resolved_name = 'Me'`,
    );
    const [connection] = await dataSource.query<{ id: number }[]>(
      `SELECT id FROM connections LIMIT 1`,
    );
    connectionId = connection.id;
    await dataSource.query(
      `INSERT INTO projects (connection_id, remote_project_id, path_with_namespace, alias, web_url, enabled, created_at)
       VALUES (?, '1', 'equipe/api', 'api', 'https://gitlab.com/equipe/api', 1, datetime('now'))`,
      [connectionId],
    );
    const [project] = await dataSource.query<{ id: number }[]>(
      `SELECT id FROM projects LIMIT 1`,
    );
    projectId = project.id;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query(`DELETE FROM merge_request_events`);
    await request(app.getHttpServer()).put('/api/v1/settings').send({
      notifDisabledTypes: [],
      notifOnlyMine: false,
      notifExcludeOwn: false,
    });
  });

  interface SeedOptions {
    type?: string;
    status?: 'provisional' | 'confirmed';
    actor?: string | null;
    involved?: string[] | null;
    dismissed?: boolean;
  }

  let sequence = 0;
  async function seed(options: SeedOptions = {}): Promise<number> {
    sequence += 1;
    const at = new Date(Date.UTC(2026, 10, 1, 10, 0, sequence)).toISOString();
    await dataSource.query(
      `INSERT INTO merge_request_events
        (occurred_at, detected_at, type, status, connection_id, project_id, mr_iid, mr_title, mr_web_url, project_alias,
         actor_username, actor_name, old_value, new_value, dismissed_at, mr_involved_usernames)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'api', ?, ?, NULL, NULL, ?, ?)`,
      [
        at,
        at,
        options.type ?? 'commented',
        options.status ?? 'confirmed',
        connectionId,
        projectId,
        sequence,
        `MR ${sequence}`,
        `https://gitlab.com/mr/${sequence}`,
        options.actor === undefined ? 'alice' : options.actor,
        options.actor === null ? null : 'Alice',
        options.dismissed ? at : null,
        options.involved === undefined
          ? null
          : options.involved === null
            ? null
            : JSON.stringify(options.involved),
      ],
    );
    const [row] = await dataSource.query<{ id: number }[]>(
      `SELECT MAX(id) AS id FROM merge_request_events`,
    );
    return row.id;
  }

  const api = () => request(app.getHttpServer());
  const list = async (): Promise<NotificationsBody> =>
    (await api().get('/api/v1/notifications')).body as NotificationsBody;
  const settings = (body: Record<string, unknown>) =>
    api().put('/api/v1/settings').send(body).expect(200);

  it('should_list_unseen_events_newest_first_with_the_exact_count', async () => {
    const first = await seed();
    const second = await seed();
    await seed({ dismissed: true });

    const body = await list();

    expect(body.count).toBe(2);
    expect(body.events.map((event) => event.id)).toEqual([second, first]);
  });

  it('should_dismiss_one_event_idempotently_and_404_on_an_unknown_one', async () => {
    const id = await seed();
    await seed();

    await api().post(`/api/v1/notifications/${id}/dismiss`).expect(204);
    await api().post(`/api/v1/notifications/${id}/dismiss`).expect(204);
    await api().post('/api/v1/notifications/99999/dismiss').expect(404);

    expect((await list()).count).toBe(1);
    const summary = await api()
      .get('/api/v1/notifications/summary')
      .expect(200);
    expect((summary.body as { count: number }).count).toBe(1);
  });

  it('should_dismiss_every_eligible_event_beyond_the_50_listed', async () => {
    for (let i = 0; i < 60; i += 1) {
      await seed();
    }

    const before = await list();
    expect(before.events).toHaveLength(50);
    expect(before.count).toBe(60);

    const result = await api()
      .post('/api/v1/notifications/dismiss-all')
      .expect(200);
    expect((result.body as { dismissed: number }).dismissed).toBe(60);
    expect((await list()).count).toBe(0);
  });

  it('should_hide_disabled_types_without_dismissing_them', async () => {
    await seed({ type: 'commented' });
    await seed({ type: 'approved' });

    await settings({ notifDisabledTypes: ['commented'] });
    expect((await list()).events.map((event) => event.type)).toEqual([
      'approved',
    ]);

    await api().post('/api/v1/notifications/dismiss-all').expect(200);
    await settings({ notifDisabledTypes: [] });
    expect((await list()).events.map((event) => event.type)).toEqual([
      'commented',
    ]);
  });

  it('should_keep_only_my_mrs_when_the_option_is_on', async () => {
    await seed({ involved: ['me', 'bob'] });
    await seed({ involved: ['bob'] });
    await seed({ involved: null });

    await settings({ notifOnlyMine: true });

    expect((await list()).count).toBe(1);
  });

  it('should_keep_nothing_for_only_my_mrs_without_a_resolved_identity', async () => {
    await seed({ involved: ['me'] });
    await dataSource.query(`UPDATE connections SET resolved_username = NULL`);
    await settings({ notifOnlyMine: true });

    expect((await list()).count).toBe(0);

    await dataSource.query(`UPDATE connections SET resolved_username = 'me'`);
  });

  it('should_exclude_my_own_actions_but_never_an_unknown_actor', async () => {
    await seed({ actor: 'me' });
    await seed({ actor: 'alice' });
    await seed({ actor: null, status: 'provisional' });

    await settings({ notifExcludeOwn: true });

    expect((await list()).count).toBe(2);
  });

  it('should_change_the_revision_when_a_provisional_event_is_confirmed_in_place', async () => {
    const id = await seed({ status: 'provisional', actor: null });
    const before = await list();

    await dataSource.query(
      `UPDATE merge_request_events SET status = 'confirmed', actor_username = 'alice' WHERE id = ?`,
      [id],
    );
    const after = await list();

    expect(after.count).toBe(before.count);
    expect(after.events[0].id).toBe(id);
    expect(after.revision).not.toBe(before.revision);
  });

  it('should_keep_a_dismissed_provisional_event_dismissed_once_confirmed', async () => {
    const id = await seed({ status: 'provisional', actor: null });
    await api().post(`/api/v1/notifications/${id}/dismiss`).expect(204);

    await dataSource.query(
      `UPDATE merge_request_events SET status = 'confirmed' WHERE id = ?`,
      [id],
    );

    expect((await list()).count).toBe(0);
  });

  it('should_reject_an_unknown_type_in_the_preferences', async () => {
    await api()
      .put('/api/v1/settings')
      .send({ notifDisabledTypes: ['nope'] })
      .expect(400);
  });
});
