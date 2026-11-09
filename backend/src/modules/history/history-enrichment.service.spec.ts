import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ForgeUnavailableException } from '../../common/exceptions/index.js';
import { ConnectionsService } from '../connections/connections.service.js';
import { ForgeClientFactory } from '../forges/forge-client.factory.js';
import { ForgeMergeRequestEvent } from '../forges/types/forge-merge-request-event.js';
import { ProjectsService } from '../projects/projects.service.js';
import {
  ENRICHMENT_MAX_PER_RUN,
  HistoryEnrichmentService,
} from './history-enrichment.service.js';
import { HistoryQueueEntry } from './entities/history-queue-entry.entity.js';
import { MergeRequestEvent } from './entities/merge-request-event.entity.js';

const NOW = new Date('2026-11-09T10:00:00.000Z');

function entry(overrides: Partial<HistoryQueueEntry> = {}): HistoryQueueEntry {
  return {
    id: 1,
    projectId: 7,
    mrIid: 12,
    mrTitle: 'Fix login',
    mrWebUrl: 'https://gitlab.example.com/-/merge_requests/12',
    requestedAt: '2026-11-09T09:58:00.000Z',
    since: '2026-11-09T09:30:00.000Z',
    attempts: 0,
    nextAttemptAt: null,
    ...overrides,
  };
}

const FORGE_EVENT: ForgeMergeRequestEvent = {
  sourceEventId: 'note:1:0',
  type: 'marked_draft',
  occurredAt: '2026-11-09T09:45:00Z',
  actor: { username: 'alice', name: 'Alice', avatarUrl: null },
  oldValue: 'false',
  newValue: 'true',
};

describe('HistoryEnrichmentService', () => {
  let service: HistoryEnrichmentService;
  const queue = { find: jest.fn(), delete: jest.fn(), update: jest.fn() };
  const events = { find: jest.fn() };
  const insertBuilder = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(undefined),
  };
  const manager = {
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => insertBuilder),
  };
  const dataSource = {
    transaction: jest.fn((cb: (m: typeof manager) => Promise<void>) =>
      cb(manager),
    ),
  };
  const projects = { findById: jest.fn() };
  const connections = { findOrThrow: jest.fn(), getToken: jest.fn() };
  const forge = { fetchMergeRequestEvents: jest.fn() };
  const forges = { forType: jest.fn(() => forge) };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    queue.find.mockResolvedValueOnce([entry()]).mockResolvedValue([]);
    queue.delete.mockResolvedValue(undefined);
    queue.update.mockResolvedValue(undefined);
    events.find.mockResolvedValue([]);
    projects.findById.mockResolvedValue({
      id: 7,
      connectionId: 3,
      remoteProjectId: '42',
      pathWithNamespace: 'equipe/api',
      webUrl: 'https://gitlab.example.com/equipe/api',
      alias: 'api',
    });
    connections.findOrThrow.mockResolvedValue({
      id: 3,
      type: 'gitlab',
      url: 'https://gitlab.example.com',
    });
    connections.getToken.mockResolvedValue('glpat-secret');
    forge.fetchMergeRequestEvents.mockResolvedValue([FORGE_EVENT]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        HistoryEnrichmentService,
        { provide: getRepositoryToken(HistoryQueueEntry), useValue: queue },
        { provide: getRepositoryToken(MergeRequestEvent), useValue: events },
        { provide: DataSource, useValue: dataSource },
        { provide: ProjectsService, useValue: projects },
        { provide: ConnectionsService, useValue: connections },
        { provide: ForgeClientFactory, useValue: forges },
      ],
    }).compile();
    service = moduleRef.get(HistoryEnrichmentService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should_return_zero_and_call_no_forge_when_the_queue_is_empty', async () => {
    queue.find.mockReset().mockResolvedValue([]);

    await expect(service.processDue(NOW)).resolves.toBe(0);
    expect(forge.fetchMergeRequestEvents).not.toHaveBeenCalled();
  });

  it('should_select_only_due_entries_oldest_first_two_at_a_time', async () => {
    await service.processDue(NOW);

    expect(queue.find).toHaveBeenCalledWith({
      where: [
        { nextAttemptAt: expect.anything() as unknown },
        { nextAttemptAt: expect.anything() as unknown },
      ],
      order: { requestedAt: 'ASC', id: 'ASC' },
      take: 2,
    });
  });

  it('should_fetch_the_forge_events_from_the_entry_window_with_the_connection_token', async () => {
    await service.processDue(NOW);

    expect(forge.fetchMergeRequestEvents).toHaveBeenCalledWith(
      'https://gitlab.example.com',
      'glpat-secret',
      {
        remoteProjectId: '42',
        pathWithNamespace: 'equipe/api',
        webUrl: 'https://gitlab.example.com/equipe/api',
      },
      12,
      {
        since: '2026-11-09T09:30:00.000Z',
        deadlineAt: expect.any(Number) as number,
      },
    );
  });

  it('should_fall_back_on_requested_at_when_the_entry_has_no_window_start', async () => {
    queue.find
      .mockReset()
      .mockResolvedValueOnce([entry({ since: null })])
      .mockResolvedValue([]);

    await service.processDue(NOW);

    const call = forge.fetchMergeRequestEvents.mock.calls[0] as unknown[];
    expect((call[4] as { since: string }).since).toBe(
      '2026-11-09T09:58:00.000Z',
    );
  });

  it('should_confirm_the_matching_provisional_event_and_delete_the_entry', async () => {
    events.find.mockResolvedValueOnce([
      { id: 5, type: 'marked_draft', oldValue: 'false', newValue: 'true' },
    ]);

    await service.processDue(NOW);

    expect(manager.update).toHaveBeenCalledWith(MergeRequestEvent, 5, {
      occurredAt: '2026-11-09T09:45:00Z',
      actorUsername: 'alice',
      actorName: 'Alice',
      actorAvatarUrl: null,
      sourceEventId: 'note:1:0',
      status: 'confirmed',
    });
    expect(insertBuilder.execute).not.toHaveBeenCalled();
    expect(manager.delete).toHaveBeenCalledWith(HistoryQueueEntry, {
      id: 1,
      requestedAt: '2026-11-09T09:58:00.000Z',
    });
  });

  it('should_create_confirmed_events_with_the_snapshot_of_the_entry_when_nothing_matches', async () => {
    const comment: ForgeMergeRequestEvent = {
      sourceEventId: 'note:9',
      type: 'commented',
      occurredAt: '2026-11-09T09:50:00Z',
      actor: { username: 'bob', name: 'Bob', avatarUrl: null },
      oldValue: null,
      newValue: '"LGTM"',
    };
    forge.fetchMergeRequestEvents.mockResolvedValue([comment]);

    await service.processDue(NOW);

    expect(insertBuilder.orIgnore).toHaveBeenCalled();
    expect(insertBuilder.values).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'commented',
        status: 'confirmed',
        sourceEventId: 'note:9',
        connectionId: 3,
        projectId: 7,
        mrIid: 12,
        mrTitle: 'Fix login',
        projectAlias: 'api',
        actorUsername: 'bob',
        newValue: '"LGTM"',
      }),
    ]);
  });

  it('should_skip_forge_events_that_are_already_stored', async () => {
    events.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ sourceEventId: 'note:1:0' }]);

    await service.processDue(NOW);

    expect(manager.update).not.toHaveBeenCalled();
    expect(insertBuilder.execute).not.toHaveBeenCalled();
    expect(manager.delete).toHaveBeenCalled();
  });

  it('should_drop_the_entry_when_its_project_no_longer_exists', async () => {
    projects.findById.mockResolvedValue(null);

    await service.processDue(NOW);

    expect(queue.delete).toHaveBeenCalledWith({ id: 1 });
    expect(forge.fetchMergeRequestEvents).not.toHaveBeenCalled();
  });

  it('should_schedule_a_retry_with_growing_delay_when_the_forge_fails', async () => {
    forge.fetchMergeRequestEvents.mockRejectedValue(
      new ForgeUnavailableException(),
    );

    await expect(service.processDue(NOW)).resolves.toBe(1);

    expect(queue.update).toHaveBeenCalledWith(
      { id: 1, requestedAt: '2026-11-09T09:58:00.000Z' },
      { attempts: 1, nextAttemptAt: '2026-11-09T10:01:00.000Z' },
    );
    expect(manager.delete).not.toHaveBeenCalled();
  });

  it('should_fail_the_entry_when_the_connection_has_no_token', async () => {
    connections.getToken.mockResolvedValue(null);

    await service.processDue(NOW);

    expect(forge.fetchMergeRequestEvents).not.toHaveBeenCalled();
    expect(queue.update).toHaveBeenCalledWith(expect.anything(), {
      attempts: 1,
      nextAttemptAt: expect.any(String) as string,
    });
  });

  it('should_abandon_the_entry_after_the_last_attempt', async () => {
    queue.find
      .mockReset()
      .mockResolvedValueOnce([entry({ attempts: 4 })])
      .mockResolvedValue([]);
    forge.fetchMergeRequestEvents.mockRejectedValue(new Error('boom'));

    await service.processDue(NOW);

    expect(queue.delete).toHaveBeenCalledWith({
      id: 1,
      requestedAt: '2026-11-09T09:58:00.000Z',
    });
    expect(queue.update).not.toHaveBeenCalled();
  });

  it('should_never_throw_when_the_failure_bookkeeping_itself_fails', async () => {
    forge.fetchMergeRequestEvents.mockRejectedValue(new Error('boom'));
    queue.update.mockRejectedValue(new Error('disk full'));

    await expect(service.processDue(NOW)).resolves.toBe(1);
  });

  it('should_stop_after_the_per_run_cap', async () => {
    queue.find.mockReset().mockResolvedValue([entry(), entry({ id: 2 })]);

    await expect(service.processDue(NOW)).resolves.toBe(ENRICHMENT_MAX_PER_RUN);
  });

  it('should_ignore_a_second_run_started_while_one_is_in_progress', async () => {
    let release: () => void = () => undefined;
    forge.fetchMergeRequestEvents.mockReturnValue(
      new Promise<ForgeMergeRequestEvent[]>((resolve) => {
        release = () => resolve([]);
      }),
    );

    const first = service.processDue(NOW);
    await new Promise((resolve) => setImmediate(resolve));
    await expect(service.processDue(NOW)).resolves.toBe(0);
    release();
    await first;
  });
});
