import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsModule } from '../projects/projects.module';
import { SettingsModule } from '../settings/settings.module';
import { UsersModule } from '../users/users.module';
import { MergeRequestAssignee } from './entities/merge-request-assignee.entity';
import { MergeRequestReviewer } from './entities/merge-request-reviewer.entity';
import { MergeRequest } from './entities/merge-request.entity';
import { MergeRequestsController } from './merge-requests.controller';
import { MergeRequestsService } from './merge-requests.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MergeRequest,
      MergeRequestReviewer,
      MergeRequestAssignee,
    ]),
    UsersModule,
    ProjectsModule,
    SettingsModule,
  ],
  controllers: [MergeRequestsController],
  providers: [MergeRequestsService],
  exports: [MergeRequestsService],
})
export class MergeRequestsModule {}
