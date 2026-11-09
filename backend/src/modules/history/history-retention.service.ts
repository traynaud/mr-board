import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SettingsService } from '../settings/settings.service.js';
import { MergeRequestEvent } from './entities/merge-request-event.entity.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Number of rows removed by a purge, by rule. */
export interface PurgeResult {
  /** Older than the retention in days (RG-036-02). */
  expired: number;
  /** Beyond the N most recent events (RG-036-02). */
  overflow: number;
}

/**
 * Applies the history retention (US-036): both limits are cumulative
 * (RG-036-02) — an event is removed when it is older than the configured
 * number of days **or** beyond the N most recent ones. Runs at the end of
 * every synchronisation and whenever the settings are saved (RG-036-04).
 * Never throws to its callers (RG-036-04): a failure is logged.
 */
@Injectable()
export class HistoryRetentionService implements OnModuleInit {
  private readonly logger = new Logger(HistoryRetentionService.name);

  constructor(
    @InjectRepository(MergeRequestEvent)
    private readonly events: Repository<MergeRequestEvent>,
    private readonly settings: SettingsService,
  ) {}

  /** Purges as soon as the retention settings are saved (RG-036-04). */
  onModuleInit(): void {
    this.settings.onChange(async () => {
      await this.purge();
    });
  }

  /**
   * Removes the events beyond the configured retention.
   * @param now reference instant (injectable for tests).
   */
  async purge(now: Date = new Date()): Promise<PurgeResult> {
    try {
      const { days, maxEvents } = await this.settings.getHistoryRetention();
      const limit = new Date(now.getTime() - days * DAY_MS).toISOString();
      const expired = await this.events
        .createQueryBuilder()
        .delete()
        .where('occurred_at < :limit', { limit })
        .execute();
      const overflow = await this.events
        .createQueryBuilder()
        .delete()
        .where(
          `id NOT IN (SELECT id FROM merge_request_events ORDER BY occurred_at DESC, id DESC LIMIT :maxEvents)`,
          { maxEvents },
        )
        .execute();
      return {
        expired: expired.affected ?? 0,
        overflow: overflow.affected ?? 0,
      };
    } catch (error) {
      this.logger.warn(
        `History purge failed: ${error instanceof Error ? error.name : String(error)}`,
      );
      return { expired: 0, overflow: 0 };
    }
  }
}
