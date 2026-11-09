import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HistoryBaseline } from './entities/history-baseline.entity.js';
import { HistoryQueueEntry } from './entities/history-queue-entry.entity.js';
import { MergeRequestEvent } from './entities/merge-request-event.entity.js';
import { HistoryService } from './history.service.js';

/** Merge request history: journal, enrichment queue and baselines (US-033). */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      MergeRequestEvent,
      HistoryQueueEntry,
      HistoryBaseline,
    ]),
  ],
  providers: [HistoryService],
  exports: [HistoryService],
})
export class HistoryModule {}
