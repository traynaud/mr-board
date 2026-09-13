import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConnectionsModule } from '../connections/connections.module';
import { ForgesModule } from '../forges/forges.module';
import { MergeRequestsModule } from '../merge-requests/merge-requests.module';
import { ProjectsModule } from '../projects/projects.module';
import { SettingsModule } from '../settings/settings.module';
import { SyncRun } from './entities/sync-run.entity';
import { SyncController } from './sync.controller';
import { SyncScheduler } from './sync-scheduler.service';
import { SyncService } from './sync.service';

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
