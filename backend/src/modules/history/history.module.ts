import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConnectionsModule } from '../connections/connections.module.js';
import { ForgesModule } from '../forges/forges.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { HistoryBaseline } from './entities/history-baseline.entity.js';
import { HistoryQueueEntry } from './entities/history-queue-entry.entity.js';
import { MergeRequestEvent } from './entities/merge-request-event.entity.js';
import { HistoryEnrichmentService } from './history-enrichment.service.js';
import { HistoryQueueScheduler } from './history-queue.scheduler.js';
import { HistoryService } from './history.service.js';

/** Merge request history: journal, enrichment queue and baselines (US-033, US-034). */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      MergeRequestEvent,
      HistoryQueueEntry,
      HistoryBaseline,
    ]),
    ConnectionsModule,
    ProjectsModule,
    ForgesModule,
  ],
  providers: [HistoryService, HistoryEnrichmentService, HistoryQueueScheduler],
  exports: [HistoryService, HistoryEnrichmentService],
})
export class HistoryModule {}
