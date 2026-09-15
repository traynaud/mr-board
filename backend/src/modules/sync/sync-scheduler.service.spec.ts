import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConnectionsService } from '../connections/connections.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { SyncRun } from './entities/sync-run.entity.js';
import { SyncScheduler } from './sync-scheduler.service.js';
import { SyncService } from './sync.service.js';

describe('SyncScheduler', () => {
  let scheduler: SyncScheduler;
  let syncRunsRepo: { findOne: jest.Mock };
  let settings: { getRefreshIntervalMin: jest.Mock };
  let connections: { findAll: jest.Mock };
  let sync: { trigger: jest.Mock };
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(async () => {
    process.env.NODE_ENV = 'not-test';
    const module = await Test.createTestingModule({
      providers: [
        SyncScheduler,
        {
          provide: getRepositoryToken(SyncRun),
          useValue: { findOne: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: SettingsService,
          useValue: { getRefreshIntervalMin: jest.fn().mockResolvedValue(5) },
        },
        {
          provide: ConnectionsService,
          useValue: { findAll: jest.fn().mockResolvedValue([{ id: 1 }]) },
        },
        { provide: SyncService, useValue: { trigger: jest.fn() } },
      ],
    }).compile();

    scheduler = module.get(SyncScheduler);
    syncRunsRepo = module.get(getRepositoryToken(SyncRun));
    settings = module.get(SettingsService);
    connections = module.get(ConnectionsService);
    sync = module.get(SyncService);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('should_do_nothing_when_running_under_the_test_environment', async () => {
    process.env.NODE_ENV = 'test';

    await scheduler.tick();

    expect(settings.getRefreshIntervalMin).not.toHaveBeenCalled();
    expect(sync.trigger).not.toHaveBeenCalled();
  });

  it('should_do_nothing_in_manual_mode', async () => {
    settings.getRefreshIntervalMin.mockResolvedValue(0);

    await scheduler.tick();

    expect(connections.findAll).not.toHaveBeenCalled();
    expect(sync.trigger).not.toHaveBeenCalled();
  });

  it('should_do_nothing_silently_when_no_connection_is_configured', async () => {
    connections.findAll.mockResolvedValue([]);

    await scheduler.tick();

    expect(sync.trigger).not.toHaveBeenCalled();
  });

  it('should_trigger_a_scheduled_sync_when_no_sync_ever_ran', async () => {
    syncRunsRepo.findOne.mockResolvedValue(null);

    await scheduler.tick();

    expect(sync.trigger).toHaveBeenCalledWith('scheduled');
  });

  it('should_trigger_a_scheduled_sync_when_the_interval_has_elapsed', async () => {
    syncRunsRepo.findOne.mockResolvedValue({
      startedAt: new Date(Date.now() - 6 * 60_000).toISOString(),
    });
    settings.getRefreshIntervalMin.mockResolvedValue(5);

    await scheduler.tick();

    expect(sync.trigger).toHaveBeenCalledWith('scheduled');
  });

  it('should_not_trigger_when_the_interval_has_not_elapsed_yet', async () => {
    syncRunsRepo.findOne.mockResolvedValue({
      startedAt: new Date(Date.now() - 1 * 60_000).toISOString(),
    });
    settings.getRefreshIntervalMin.mockResolvedValue(5);

    await scheduler.tick();

    expect(sync.trigger).not.toHaveBeenCalled();
  });

  it('should_reset_the_countdown_after_any_manual_sync', async () => {
    syncRunsRepo.findOne.mockResolvedValue({
      startedAt: new Date(Date.now() - 1 * 60_000).toISOString(),
      trigger: 'manual',
    });
    settings.getRefreshIntervalMin.mockResolvedValue(5);

    await scheduler.tick();

    expect(sync.trigger).not.toHaveBeenCalled();
  });
});
