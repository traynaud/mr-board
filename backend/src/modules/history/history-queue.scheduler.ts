import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { HistoryEnrichmentService } from './history-enrichment.service.js';

/** Cadence at which the history queue is looked at (RG-034-03). */
export const HISTORY_QUEUE_TICK_MS = 10_000;

/** Drives the enrichment worker, independently of the synchronisation cycle (RG-034-03). */
@Injectable()
export class HistoryQueueScheduler {
  constructor(private readonly enrichment: HistoryEnrichmentService) {}

  /**
   * Runs on every tick. No-op in the test environment, like `SyncScheduler`,
   * so e2e assertions are not interleaved with background processing.
   */
  @Interval(HISTORY_QUEUE_TICK_MS)
  async tick(): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    await this.enrichment.processDue();
  }
}
