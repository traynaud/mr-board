import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GitlabModule } from '../gitlab/gitlab.module';
import { MergeRequestsModule } from '../merge-requests/merge-requests.module';
import { ProjectsModule } from '../projects/projects.module';
import { SettingsModule } from '../settings/settings.module';
import { SyncRun } from './entities/sync-run.entity';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SyncRun]),
    SettingsModule,
    ProjectsModule,
    GitlabModule,
    MergeRequestsModule,
  ],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
