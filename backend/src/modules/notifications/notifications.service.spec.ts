import { EntityNotFoundException } from '../../common/exceptions/index.js';
import { NotificationsService } from './notifications.service.js';

/** A chainable stand-in for TypeORM's query builder that records its calls. */
function builder(result: Record<string, unknown> = {}) {
  const calls: { method: string; args: unknown[] }[] = [];
  const proxy: Record<string, unknown> = new Proxy(
    {},
    {
      get: (_target, method: string) => {
        // A query builder is not a thenable: `await` must not wait on it.
        if (method === 'then') return undefined;
        if (method === 'getMany')
          return () => Promise.resolve(result.many ?? []);
        if (method === 'getRawOne') return () => Promise.resolve(result.raw);
        if (method === 'execute')
          return () => Promise.resolve(result.execute ?? { affected: 0 });
        if (method === 'getQuery')
          return () => 'SELECT e.id FROM merge_request_events e';
        if (method === 'getParameters')
          return () => ({ disabledTypes: ['commented'] });
        return (...args: unknown[]) => {
          calls.push({ method, args });
          return proxy;
        };
      },
    },
  );
  return { proxy, calls };
}

describe('NotificationsService', () => {
  const events = { createQueryBuilder: jest.fn(), existsBy: jest.fn() };
  const settings = { getNotificationPreferences: jest.fn() };
  const connections = { list: jest.fn() };
  const service = new NotificationsService(
    events as never,
    settings as never,
    connections as never,
  );

  const sqlOf = (calls: { method: string; args: unknown[] }[]): string =>
    calls
      .filter((call) => call.method === 'where' || call.method === 'andWhere')
      .map((call) => String(call.args[0]))
      .join(' | ');

  beforeEach(() => {
    jest.clearAllMocks();
    settings.getNotificationPreferences.mockResolvedValue({
      notifDisabledTypes: [],
      notifOnlyMine: false,
      notifExcludeOwn: false,
    });
    connections.list.mockResolvedValue([
      { id: 1, identity: { username: 'Me' } },
      { id: 2, identity: null },
    ]);
  });

  it('should_only_filter_on_the_unseen_state_without_preferences', async () => {
    const { proxy, calls } = builder({
      raw: { maxId: 9, total: '4', provisional: '1' },
    });
    events.createQueryBuilder.mockReturnValue(proxy);

    await expect(service.summary()).resolves.toEqual({
      count: 4,
      revision: '9:4:1',
    });
    expect(sqlOf(calls)).toBe('e.dismissed_at IS NULL');
  });

  it('should_return_a_zero_summary_when_nothing_matches', async () => {
    const { proxy } = builder({ raw: undefined });
    events.createQueryBuilder.mockReturnValue(proxy);

    await expect(service.summary()).resolves.toEqual({
      count: 0,
      revision: '0:0:0',
    });
  });

  it('should_apply_the_disabled_types_and_the_scope_of_my_identity', async () => {
    settings.getNotificationPreferences.mockResolvedValue({
      notifDisabledTypes: ['commented'],
      notifOnlyMine: true,
      notifExcludeOwn: true,
    });
    const { proxy, calls } = builder({
      raw: { maxId: 1, total: 1, provisional: 0 },
    });
    events.createQueryBuilder.mockReturnValue(proxy);

    await service.summary();

    const sql = sqlOf(calls);
    expect(sql).toContain('e.type NOT IN (:...disabledTypes)');
    expect(sql).toContain('NOT (e.actor_username IS NOT NULL');
    expect(sql).toContain('json_each(e.mr_involved_usernames)');
    const parameters = calls.find((call) => call.method === 'setParameters')
      ?.args[0] as Record<string, unknown>;
    expect(parameters).toMatchObject({
      ownConn0: 1,
      ownUser0: 'me',
      mineConn0: 1,
      mineUser0: 'me',
    });
    expect(parameters).not.toHaveProperty('mineConn1');
  });

  it('should_match_nothing_for_only_mine_without_any_resolved_identity', async () => {
    settings.getNotificationPreferences.mockResolvedValue({
      notifDisabledTypes: [],
      notifOnlyMine: true,
      notifExcludeOwn: false,
    });
    connections.list.mockResolvedValue([{ id: 1, identity: null }]);
    const { proxy, calls } = builder({
      raw: { maxId: null, total: 0, provisional: 0 },
    });
    events.createQueryBuilder.mockReturnValue(proxy);

    await service.summary();

    expect(sqlOf(calls)).toContain('1 = 0');
  });

  it('should_list_the_events_with_the_summary', async () => {
    const row = {
      id: 3,
      occurredAt: '2026-11-09T10:00:00.000Z',
      type: 'approved',
      status: 'confirmed',
      projectId: 1,
      projectAlias: 'api',
      mrIid: 7,
      mrTitle: 'T',
      mrWebUrl: 'https://x/7',
      actorUsername: 'alice',
      actorName: 'Alice',
      actorAvatarUrl: null,
      oldValue: null,
      newValue: null,
    };
    const { proxy, calls } = builder({
      many: [row],
      raw: { maxId: 3, total: 1, provisional: 0 },
    });
    events.createQueryBuilder.mockReturnValue(proxy);

    const result = await service.list(10);

    expect(result.count).toBe(1);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      id: 3,
      actor: { username: 'alice' },
    });
    expect(calls.find((call) => call.method === 'take')?.args[0]).toBe(10);
  });

  it('should_throw_not_found_when_dismissing_an_unknown_event', async () => {
    events.existsBy.mockResolvedValue(false);

    await expect(service.dismiss(5)).rejects.toBeInstanceOf(
      EntityNotFoundException,
    );
  });

  it('should_stamp_the_dismissal_of_a_known_event', async () => {
    events.existsBy.mockResolvedValue(true);
    const { proxy, calls } = builder();
    events.createQueryBuilder.mockReturnValue(proxy);

    await service.dismiss(5);

    const set = calls.find((call) => call.method === 'set')?.args[0] as {
      dismissedAt: string;
    };
    expect(typeof set.dismissedAt).toBe('string');
    expect(calls.find((call) => call.method === 'where')?.args).toEqual([
      'id = :id AND dismissed_at IS NULL',
      { id: 5 },
    ]);
  });

  it('should_dismiss_every_eligible_event_in_one_statement', async () => {
    const { proxy, calls } = builder({ execute: { affected: 12 } });
    events.createQueryBuilder.mockReturnValue(proxy);

    await expect(service.dismissAll()).resolves.toEqual({ dismissed: 12 });
    expect(
      calls.some(
        (call) =>
          call.method === 'where' &&
          String(call.args[0]).startsWith('id IN (SELECT e.id'),
      ),
    ).toBe(true);
  });

  it('should_report_zero_when_the_driver_gives_no_affected_count', async () => {
    const { proxy } = builder({ execute: {} });
    events.createQueryBuilder.mockReturnValue(proxy);

    await expect(service.dismissAll()).resolves.toEqual({ dismissed: 0 });
  });
});
