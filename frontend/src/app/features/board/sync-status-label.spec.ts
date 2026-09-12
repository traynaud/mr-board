import { SyncRun } from '../../models/sync-status.model';
import { computeNextRunTooltip, computeSyncStatusLabel } from './sync-status-label';

const NOW = new Date('2026-09-11T08:10:00.000Z').getTime();

function run(overrides: Partial<SyncRun> = {}): SyncRun {
  return {
    startedAt: '2026-09-11T08:00:00.000Z',
    finishedAt: '2026-09-11T08:00:00.000Z',
    status: 'success',
    mrCount: 3,
    errorMessage: null,
    trigger: 'manual',
    ...overrides,
  };
}

describe('computeSyncStatusLabel', () => {
  it('should_show_syncing_while_running_regardless_of_last_run', () => {
    expect(computeSyncStatusLabel({ running: true, lastRun: null }, NOW)).toEqual({
      key: 'board.sync.syncing',
      accent: true,
    });
    expect(computeSyncStatusLabel({ running: true, lastRun: run() }, NOW)).toEqual({
      key: 'board.sync.syncing',
      accent: true,
    });
  });

  it('should_show_never_synced_when_there_is_no_last_run', () => {
    expect(computeSyncStatusLabel({ running: false, lastRun: null }, NOW)).toEqual({
      key: 'board.sync.never',
      accent: false,
    });
  });

  it('should_show_just_now_for_a_success_finished_less_than_a_minute_ago', () => {
    const label = computeSyncStatusLabel(
      { running: false, lastRun: run({ finishedAt: new Date(NOW - 30_000).toISOString() }) },
      NOW,
    );
    expect(label).toEqual({ key: 'board.sync.justNow', accent: false });
  });

  it('should_show_minutes_ago_for_an_older_success', () => {
    const label = computeSyncStatusLabel(
      { running: false, lastRun: run({ finishedAt: new Date(NOW - 2 * 60_000).toISOString() }) },
      NOW,
    );
    expect(label).toEqual({
      key: 'board.sync.minutesAgo',
      params: { minutes: 2 },
      accent: false,
    });
  });

  it('should_show_minutes_ago_for_a_partial_run', () => {
    const label = computeSyncStatusLabel(
      {
        running: false,
        lastRun: run({
          status: 'partial',
          finishedAt: new Date(NOW - 5 * 60_000).toISOString(),
        }),
      },
      NOW,
    );
    expect(label.key).toBe('board.sync.minutesAgo');
  });

  it('should_show_failed_minutes_ago_in_accent_for_an_error_run', () => {
    const label = computeSyncStatusLabel(
      {
        running: false,
        lastRun: run({ status: 'error', finishedAt: new Date(NOW - 3 * 60_000).toISOString() }),
      },
      NOW,
    );
    expect(label).toEqual({
      key: 'board.sync.failedMinutesAgo',
      params: { minutes: 3 },
      accent: true,
    });
  });

  it('should_never_return_a_negative_minute_count', () => {
    const label = computeSyncStatusLabel(
      { running: false, lastRun: run({ finishedAt: new Date(NOW + 60_000).toISOString() }) },
      NOW,
    );
    expect(label.key).toBe('board.sync.justNow');
  });
});

describe('computeNextRunTooltip', () => {
  it('should_show_the_manual_tooltip_when_there_is_no_next_run', () => {
    expect(computeNextRunTooltip(null)).toEqual({
      key: 'board.sync.manualTooltip',
    });
  });

  it('should_show_the_formatted_time_of_the_next_run', () => {
    const local = new Date(2026, 8, 12, 14, 5);

    expect(computeNextRunTooltip(local.toISOString())).toEqual({
      key: 'board.sync.nextRunTooltip',
      params: { time: '14:05' },
    });
  });
});
