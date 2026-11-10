import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/create-test-app.js';

interface TimelineBody {
  events: { id: number; mrTitle: string; mrIid: number }[];
  nextCursor: string | null;
  total: number;
}

interface SeedEvent {
  at: string;
  type: string;
  iid: number;
  title: string;
  actor: string | null;
  project?: number;
}

describe('History filters (e2e, US-038)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const projectIds: number[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    await request(app.getHttpServer()).post('/api/v1/connections').send({
      type: 'gitlab',
      name: 'GitLab',
      url: 'https://gitlab.com',
      token: 'glpat-filters-e2e-token',
    });
    for (const alias of ['api', 'web']) {
      await dataSource.query(
        `INSERT INTO projects (connection_id, remote_project_id, path_with_namespace, alias, web_url, enabled, created_at)
         SELECT id, ?, ?, ?, ?, 1, datetime('now') FROM connections LIMIT 1`,
        [alias, `equipe/${alias}`, alias, `https://gitlab.com/equipe/${alias}`],
      );
    }
    const rows = await dataSource.query<{ id: number }[]>(
      `SELECT id FROM projects ORDER BY id`,
    );
    projectIds.push(...rows.map((row) => row.id));

    const events: SeedEvent[] = [
      {
        at: '2026-11-06T09:00:00.000Z',
        type: 'approved',
        iid: 128,
        title: 'Corrige la redirection',
        actor: 'alice',
      },
      {
        at: '2026-11-07T09:00:00.000Z',
        type: 'merged',
        iid: 120,
        title: 'Réfacto de la facturation',
        actor: 'bob',
      },
      {
        at: '2026-11-08T09:00:00.000Z',
        type: 'commented',
        iid: 131,
        title: 'Refonte page profil',
        actor: 'alice',
        project: 1,
      },
      {
        at: '2026-11-09T09:00:00.000Z',
        type: 'label_added',
        iid: 126,
        title: '100% fiable_ok',
        actor: null,
        project: 1,
      },
      {
        at: '2026-11-09T10:00:00.000Z',
        type: 'approved',
        iid: 42,
        title: 'Nettoyage',
        actor: 'alice',
      },
    ];
    for (const event of events) {
      await dataSource.query(
        `INSERT INTO merge_request_events
          (occurred_at, detected_at, type, status, connection_id, project_id, mr_iid, mr_title, mr_web_url, project_alias,
           actor_username, actor_name)
         VALUES (?, ?, ?, 'confirmed', (SELECT connection_id FROM projects WHERE id = ?), ?, ?, ?, 'https://x/mr', 'p', ?, ?)`,
        [
          event.at,
          event.at,
          event.type,
          projectIds[event.project ?? 0],
          projectIds[event.project ?? 0],
          event.iid,
          event.title,
          event.actor,
          event.actor === null ? null : event.actor.toUpperCase(),
        ],
      );
    }
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (query = '') =>
    request(app.getHttpServer()).get(`/api/v1/history${query}`);
  const iids = async (query: string): Promise<number[]> =>
    ((await get(query).expect(200)).body as TimelineBody).events.map(
      (event) => event.mrIid,
    );

  it('returns everything without filter', async () => {
    expect(await iids('')).toEqual([42, 126, 131, 120, 128]);
  });

  it('filters by type with OR inside the filter', async () => {
    expect(await iids('?type=approved,merged')).toEqual([42, 120, 128]);
    expect(await iids('?type=approved&type=merged')).toEqual([42, 120, 128]);
  });

  it('combines filters with AND (RG-038-02)', async () => {
    expect(await iids('?type=approved,merged&actor=alice')).toEqual([42, 128]);
  });

  it('filters by actor and by unknown actor', async () => {
    expect(await iids('?actor=bob')).toEqual([120]);
    expect(await iids('?actor=none')).toEqual([126]);
    expect(await iids('?actor=bob,none')).toEqual([126, 120]);
  });

  it('filters by project', async () => {
    expect(await iids(`?project=${projectIds[1]}`)).toEqual([126, 131]);
    expect(
      await iids(`?project=${projectIds[0]},${projectIds[1]}`),
    ).toHaveLength(5);
  });

  it('searches the title ignoring case and accents, all terms required', async () => {
    expect(await iids('?q=refacto fact')).toEqual([120]);
    expect(await iids('?q=RÉFACTO')).toEqual([120]);
    expect(await iids('?q=refacto login')).toEqual([]);
  });

  it('searches by number in addition to the title', async () => {
    expect(await iids('?q=!128')).toEqual([128]);
    expect(await iids('?q=%23131')).toEqual([131]);
    expect(await iids('?q=42')).toEqual([42]);
  });

  it('treats LIKE wildcards as plain text', async () => {
    expect(await iids('?q=100%25')).toEqual([126]);
    expect(await iids('?q=fiable_ok')).toEqual([126]);
    expect(await iids('?q=fiable_ko')).toEqual([]);
    expect(await iids('?q=%25')).toEqual([126]);
  });

  it('filters by period, from inclusive and to exclusive', async () => {
    expect(
      await iids('?from=2026-11-07T00:00:00.000Z&to=2026-11-09T00:00:00.000Z'),
    ).toEqual([131, 120]);
    expect(await iids('?from=2026-11-09T09:00:00.000Z')).toEqual([42, 126]);
    expect(await iids('?to=2026-11-07T09:00:00.000Z')).toEqual([128]);
  });

  it('counts the filtered events in total and keeps filters across pages', async () => {
    const first = (
      await get('?type=approved,merged,commented&limit=2').expect(200)
    ).body as TimelineBody;
    expect(first.total).toBe(4);
    expect(first.events.map((e) => e.mrIid)).toEqual([42, 131]);
    const second = (
      await get(
        `?type=approved,merged,commented&limit=2&cursor=${first.nextCursor}`,
      ).expect(200)
    ).body as TimelineBody;
    expect(second.events.map((e) => e.mrIid)).toEqual([120, 128]);
    expect(second.nextCursor).toBeNull();
    expect(second.total).toBe(4);
  });

  it('returns an empty page when nothing matches', async () => {
    const body = (await get('?q=introuvable').expect(200)).body as TimelineBody;
    expect(body).toEqual({ events: [], nextCursor: null, total: 0 });
  });

  it('lists the distinct known actors sorted by name', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/history/actors')
      .expect(200);
    expect(res.body).toEqual([
      { username: 'alice', name: 'ALICE', avatarUrl: null },
      { username: 'bob', name: 'BOB', avatarUrl: null },
    ]);
  });

  it.each([
    'type=inconnu',
    'type=approved,inconnu',
    'project=abc',
    'from=hier',
    'to=2026-13-45',
    'from=2026-02-30',
    'to=2026-11-31T10:00:00Z',
    'from=2026-11-09T00:00:00Z&to=2026-11-06T00:00:00Z',
    `q=${'x'.repeat(101)}`,
    'unknown=1',
  ])('rejects %s with 400', async (query) => {
    await get(`?${query}`).expect(400);
  });
});
