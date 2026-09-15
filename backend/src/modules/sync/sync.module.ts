import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConnectionsModule } from '../connections/connections.module.js';
import { ForgesModule } from '../forges/forges.module.js';
import { MergeRequestsModule } from '../merge-requests/merge-requests.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { SyncRun } from './entities/sync-run.entity.js';
import { SyncController } from './sync.controller.js';
import { SyncScheduler } from './sync-scheduler.service.js';
import { SyncService } from './sync.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([SyncRun]),
    SettingsModule,
    ConnectionsModule,
    ProjectsModule,
    ForgesModule,
    MergeRequestsModule,
  ],
  controllers: [SyncController],
  providers: [SyncService, SyncScheduler],
  exports: [SyncService],
})
export class SyncModule {}
