import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ForgeMergeRequest } from '../forges/types/forge-merge-request.js';
import { MergeRequestSnapshot } from './domain/merge-request-snapshot.js';
import { HistoryBaseline } from './entities/history-baseline.entity.js';
import { HistoryQueueEntry } from './entities/history-queue-entry.entity.js';
import { MergeRequestEvent } from './entities/merge-request-event.entity.js';
import { HistoryService } from './history.service.js';

const PROJECT = { id: 7, connectionId: 3, alias: 'api' };
const NOW = '2026-11-09T10:00:00.000Z';

function forgeMr(
  iid: number,
  overrides: Partial<ForgeMergeRequest> = {},
): ForgeMergeRequest {
  return {
    remoteId: String(iid),
    iid,
    title: `MR ${iid}`,
    webUrl: `https://gitlab.example.com/-/merge_requests/${iid}`,
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
      username: 'alice',
      name: 'Alice',
      avatarUrl: null,
      webUrl: 'https://gitlab.example.com/alice',
    },
    reviewers: [],
    assignees: [],
    approvedBy: [],
    mergeStatus: { state: 'mergeable', reasons: [] },
    ...overrides,
  };
}

function snapshot(
  iid: number,
  overrides: Partial<MergeRequestSnapshot> = {},
): MergeRequestSnapshot {
  return {
    iid,
    title: `MR ${iid}`,
    webUrl: `https://gitlab.example.com/-/merge_requests/${iid}`,
    draft: false,
    labels: [],
    reviewers: [],
    assignees: [],
    approvers: [],
    commentsCount: 0,
    ...overrides,
  };
}

describe('HistoryService', () => {
  let service: HistoryService;
  const baselines = { existsBy: jest.fn(), insert: jest.fn() };
  const manager = {
    insert: jest.fn(),
    upsert: jest.fn(),
    find: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn((cb: (m: typeof manager) => Promise<void>) =>
      cb(manager),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    baselines.existsBy.mockResolvedValue(true);
    manager.find.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        HistoryService,
        { provide: getRepositoryToken(HistoryBaseline), useValue: baselines },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    service = moduleRef.get(HistoryService);
  });

  it('should_only_record_the_baseline_when_the_project_was_never_synchronised', async () => {
    baselines.existsBy.mockResolvedValue(false);

    await service.recordProjectChanges({
      project: PROJECT,
      previous: [],
      incoming: [forgeMr(1), forgeMr(2)],
      detectedAt: NOW,
    });

    expect(baselines.insert).toHaveBeenCalledWith({
      projectId: 7,
      baselinedAt: NOW,
    });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('should_write_nothing_when_nothing_changed', async () => {
    await service.recordProjectChanges({
      project: PROJECT,
      previous: [snapshot(1)],
      incoming: [forgeMr(1)],
      detectedAt: NOW,
    });

    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(baselines.insert).not.toHaveBeenCalled();
  });

  it('should_insert_provisional_events_and_queue_the_mr_when_the_title_changes', async () => {
    await service.recordProjectChanges({
      project: PROJECT,
      previous: [snapshot(1, { title: 'Old' })],
      incoming: [forgeMr(1, { title: 'New' })],
      detectedAt: NOW,
    });

    expect(manager.insert).toHaveBeenCalledWith(MergeRequestEvent, [
      {
        occurredAt: NOW,
        detectedAt: NOW,
        type: 'title_changed',
        status: 'provisional',
        sourceEventId: null,
        connectionId: 3,
        projectId: 7,
        mrIid: 1,
        mrTitle: 'New',
        mrWebUrl: 'https://gitlab.example.com/-/merge_requests/1',
        projectAlias: 'api',
        actorUsername: null,
        actorName: null,
        actorAvatarUrl: null,
        oldValue: '"Old"',
        newValue: '"New"',
      },
    ]);
    expect(manager.upsert).toHaveBeenCalledWith(
      HistoryQueueEntry,
      [
        {
          projectId: 7,
          mrIid: 1,
          mrTitle: 'New',
          mrWebUrl: 'https://gitlab.example.com/-/merge_requests/1',
          requestedAt: NOW,
          since: '2026-11-09T09:55:00.000Z',
          attempts: 0,
          nextAttemptAt: null,
        },
      ],
      ['projectId', 'mrIid'],
    );
  });

  it('should_emit_created_for_a_new_mr_once_the_project_is_baselined', async () => {
    await service.recordProjectChanges({
      project: PROJECT,
      previous: [],
      incoming: [forgeMr(9)],
      detectedAt: NOW,
    });

    const [, rows] = manager.insert.mock.calls[0] as [
      unknown,
      Partial<MergeRequestEvent>[],
    ];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: 'created',
      status: 'confirmed',
      mrIid: 9,
      occurredAt: '2026-09-01T10:00:00Z',
      actorUsername: 'alice',
      actorName: 'Alice',
      oldValue: null,
      newValue: '"MR 9"',
    });
    const [, entries] = manager.upsert.mock.calls[0] as [
      unknown,
      { since: string }[],
    ];
    expect(entries[0]?.since).toBe('2026-09-01T10:00:00Z');
  });

  it('should_queue_without_event_when_only_the_comment_count_grows', async () => {
    await service.recordProjectChanges({
      project: PROJECT,
      previous: [snapshot(1, { commentsCount: 1 })],
      incoming: [forgeMr(1, { commentsCount: 2 })],
      detectedAt: NOW,
    });

    expect(manager.insert).not.toHaveBeenCalled();
    expect(manager.upsert).toHaveBeenCalledTimes(1);
  });

  it('should_queue_each_changed_mr_only_once_even_with_several_events', async () => {
    await service.recordProjectChanges({
      project: PROJECT,
      previous: [snapshot(1), snapshot(2)],
      incoming: [
        forgeMr(1, { title: 'A', draft: true, labels: ['x', 'y'] }),
        forgeMr(2),
      ],
      detectedAt: NOW,
    });

    const [, events] = manager.insert.mock.calls[0] as [unknown, unknown[]];
    expect(events).toHaveLength(4);
    const [, entries] = manager.upsert.mock.calls[0] as [
      unknown,
      { mrIid: number }[],
    ];
    expect(entries.map((e) => e.mrIid)).toEqual([1]);
  });

  it('should_start_the_window_before_the_previous_synchronisation_of_the_mr', async () => {
    await service.recordProjectChanges({
      project: PROJECT,
      previous: [
        snapshot(1, { title: 'Old', syncedAt: '2026-11-09T09:30:00.000Z' }),
      ],
      incoming: [forgeMr(1, { title: 'New' })],
      detectedAt: NOW,
    });

    const [, entries] = manager.upsert.mock.calls[0] as [
      unknown,
      { since: string }[],
    ];
    expect(entries[0]?.since).toBe('2026-11-09T09:25:00.000Z');
  });

  it('should_keep_the_oldest_window_start_of_an_mr_already_waiting_in_the_queue', async () => {
    manager.find.mockResolvedValue([
      { mrIid: 1, since: '2026-11-09T08:00:00.000Z', requestedAt: NOW },
    ]);

    await service.recordProjectChanges({
      project: PROJECT,
      previous: [snapshot(1, { title: 'Old' })],
      incoming: [forgeMr(1, { title: 'New' })],
      detectedAt: NOW,
    });

    const [, entries] = manager.upsert.mock.calls[0] as [
      unknown,
      { since: string }[],
    ];
    expect(entries[0]?.since).toBe('2026-11-09T08:00:00.000Z');
  });

  it('should_propagate_the_error_when_the_transaction_fails', async () => {
    dataSource.transaction.mockRejectedValueOnce(new Error('disk full'));

    await expect(
      service.recordProjectChanges({
        project: PROJECT,
        previous: [snapshot(1)],
        incoming: [forgeMr(1, { title: 'New' })],
        detectedAt: NOW,
      }),
    ).rejects.toThrow('disk full');
  });
});
