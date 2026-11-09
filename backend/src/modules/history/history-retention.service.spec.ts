import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SettingsService } from '../settings/settings.service.js';
import { HistoryRetentionService } from './history-retention.service.js';
import { MergeRequestEvent } from './entities/merge-request-event.entity.js';

const NOW = new Date('2026-11-09T10:00:00.000Z');

describe('HistoryRetentionService', () => {
  let service: HistoryRetentionService;
  const builder = {
    delete: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };
  const events = { createQueryBuilder: jest.fn(() => builder) };
  const settings = { getHistoryRetention: jest.fn(), onChange: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    settings.getHistoryRetention.mockResolvedValue({
      days: 60,
      maxEvents: 5000,
    });
    builder.execute
      .mockResolvedValueOnce({ affected: 3 })
      .mockResolvedValueOnce({ affected: 2 });
    const moduleRef = await Test.createTestingModule({
      providers: [
        HistoryRetentionService,
        { provide: getRepositoryToken(MergeRequestEvent), useValue: events },
        { provide: SettingsService, useValue: settings },
      ],
    }).compile();
    service = moduleRef.get(HistoryRetentionService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should_delete_events_older_than_the_retention_in_days', async () => {
    await service.purge(NOW);

    expect(builder.where).toHaveBeenNthCalledWith(1, 'occurred_at < :limit', {
      limit: '2026-09-10T10:00:00.000Z',
    });
  });

  it('should_keep_only_the_n_most_recent_events', async () => {
    await service.purge(NOW);

    expect(builder.where).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        'ORDER BY occurred_at DESC, id DESC LIMIT :maxEvents',
      ),
      { maxEvents: 5000 },
    );
  });

  it('should_report_what_each_rule_removed', async () => {
    await expect(service.purge(NOW)).resolves.toEqual({
      expired: 3,
      overflow: 2,
    });
  });

  it('should_count_zero_when_the_driver_reports_no_affected_rows', async () => {
    builder.execute.mockReset().mockResolvedValue({});

    await expect(service.purge(NOW)).resolves.toEqual({
      expired: 0,
      overflow: 0,
    });
  });

  it('should_read_the_retention_fresh_on_each_purge', async () => {
    settings.getHistoryRetention.mockResolvedValue({ days: 7, maxEvents: 100 });

    await service.purge(NOW);

    expect(builder.where).toHaveBeenNthCalledWith(1, 'occurred_at < :limit', {
      limit: '2026-11-02T10:00:00.000Z',
    });
  });

  it('should_never_throw_when_the_purge_fails', async () => {
    builder.execute.mockReset().mockRejectedValue(new Error('locked'));

    await expect(service.purge(NOW)).resolves.toEqual({
      expired: 0,
      overflow: 0,
    });
  });

  it('should_purge_when_the_settings_are_saved_rg_036_04', async () => {
    service.onModuleInit();
    const [listener] = settings.onChange.mock.calls[0] as [() => Promise<void>];

    await listener();

    expect(builder.execute).toHaveBeenCalledTimes(2);
  });
});
