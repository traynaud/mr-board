import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SettingsService } from '../settings/settings.service';
import { computeNextRunAt } from './domain/compute-next-run-at';
import { SyncRun } from './entities/sync-run.entity';
import { SyncService } from './sync.service';

/** Cadence at which the scheduler re-evaluates whether a sync is due. */
export const SCHEDULER_TICK_MS = 15_000;

/**
 * Triggers scheduled synchronisations at the cadence configured in Settings
 * (RG-013-01 to RG-013-03, RG-013-07). Re-evaluates "is a sync due?" on every
 * tick instead of reprogramming an interval on settings changes — the next
 * tick (≤ `SCHEDULER_TICK_MS` later) always reads the current
 * `refreshIntervalMin`, so no hot-restart is required.
 */
@Injectable()
export class SyncScheduler {
  constructor(
    @InjectRepository(SyncRun)
    private readonly syncRuns: Repository<SyncRun>,
    private readonly settings: SettingsService,
    private readonly sync: SyncService,
  ) {}

  /**
   * Runs on every tick. No-op in the test environment — `create-test-app.ts`
   * boots the full `AppModule` (including `ScheduleModule.forRoot()`), so
   * without this guard scheduled syncs would interleave with e2e assertions.
   */
  @Interval(SCHEDULER_TICK_MS)
  async tick(): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    const refreshIntervalMin = await this.settings.getRefreshIntervalMin();
    if (refreshIntervalMin === 0) {
      return;
    }
    const token = await this.settings.getToken();
    if (!token) {
      return;
    }
    const lastRun = await this.syncRuns.findOne({
      where: {},
      order: { startedAt: 'DESC' },
    });
    const now = new Date().toISOString();
    const nextRunAt = computeNextRunAt(
      refreshIntervalMin,
      lastRun?.startedAt ?? null,
      now,
    );
    if (nextRunAt !== null && nextRunAt <= now) {
      await this.sync.trigger('scheduled');
    }
  }
}
