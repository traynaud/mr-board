import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/create-test-app.js';

interface TimelineBody {
  events: {
    id: number;
    type: string;
    actor: { username: string | null; name: string | null } | null;
    oldValue: unknown;
    newValue: unknown;
  }[];
  nextCursor: string | null;
  total: number;
}

describe('History timeline (e2e, US-037)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    const api = request(app.getHttpServer());
    await api.post('/api/v1/connections').send({
      type: 'gitlab',
      name: 'GitLab',
      url: 'https://gitlab.com',
      token: 'glpat-timeline-e2e-token',
    });
    await dataSource.query(
      `INSERT INTO projects (connection_id, remote_project_id, path_with_namespace, alias, web_url, enabled, created_at)
       SELECT id, '1', 'equipe/api', 'api', 'https://gitlab.com/equipe/api', 1, datetime('now') FROM connections LIMIT 1`,
    );
  });

  afterAll(async () => {
    await app.close();
  });

  async function seed(
    count: number,
    overrides: { actor?: string | null } = {},
    offset = 0,
  ): Promise<void> {
    const [project] = await dataSource.query<
      { id: number; connection_id: number }[]
    >(`SELECT id, connection_id FROM projects LIMIT 1`);
    for (let i = 0; i < count; i += 1) {
      const occurredAt = new Date(
        Date.UTC(2026, 10, 1, 10, 0, i + offset),
      ).toISOString();
      await dataSource.query(
        `INSERT INTO merge_request_events
          (occurred_at, detected_at, type, status, connection_id, project_id, mr_iid, mr_title, mr_web_url, project_alias,
           actor_username, actor_name, old_value, new_value)
         VALUES (?, ?, ?, 'confirmed', ?, ?, ?, ?, ?, 'api', ?, ?, ?, ?)`,
        [
          occurredAt,
          occurredAt,
          i % 2 === 0 ? 'title_changed' : 'marked_draft',
          project.connection_id,
          project.id,
          i,
          `MR ${i}`,
          `https://gitlab.com/mr/${i}`,
          overrides.actor === undefined ? 'mdupont' : overrides.actor,
          overrides.actor === null ? null : 'Marie Dupont',
          i % 2 === 0 ? JSON.stringify('Old') : JSON.stringify(false),
          i % 2 === 0 ? JSON.stringify('New') : JSON.stringify(true),
        ],
      );
    }
  }

  const get = (query = '') =>
    request(app.getHttpServer()).get(`/api/v1/history${query}`);

  it('returns an empty timeline when nothing happened', async () => {
    const res = await get().expect(200);
    expect(res.body).toEqual({ events: [], nextCursor: null, total: 0 });
  });

  it('lists events newest first with deserialised values', async () => {
    await seed(5);
    const body = (await get().expect(200)).body as TimelineBody;
    expect(body.total).toBe(5);
    expect(body.nextCursor).toBeNull();
    expect(body.events.map((e) => e.id)).toEqual([5, 4, 3, 2, 1]);
    expect(body.events[0]).toMatchObject({
      type: 'title_changed',
      oldValue: 'Old',
      newValue: 'New',
      actor: { username: 'mdupont', name: 'Marie Dupont' },
    });
    expect(body.events[1]).toMatchObject({ oldValue: false, newValue: true });
  });

  it('paginates with an opaque cursor without overlap or gap', async () => {
    const first = (await get('?limit=2').expect(200)).body as TimelineBody;
    expect(first.events.map((e) => e.id)).toEqual([5, 4]);
    expect(first.nextCursor).not.toBeNull();
    const second = (
      await get(`?limit=2&cursor=${first.nextCursor}`).expect(200)
    ).body as TimelineBody;
    expect(second.events.map((e) => e.id)).toEqual([3, 2]);
    const third = (
      await get(`?limit=2&cursor=${second.nextCursor}`).expect(200)
    ).body as TimelineBody;
    expect(third.events.map((e) => e.id)).toEqual([1]);
    expect(third.nextCursor).toBeNull();
    expect(third.total).toBe(5);
  });

  it('exposes a null actor when the author is unknown', async () => {
    await seed(1, { actor: null }, 3600);
    const body = (await get('?limit=1').expect(200)).body as TimelineBody;
    expect(body.events[0].actor).toBeNull();
  });

  it.each(['limit=0', 'limit=201', 'limit=abc', 'cursor=garbage'])(
    'rejects %s with 400',
    async (query) => {
      await get(`?${query}`).expect(400);
    },
  );
});
