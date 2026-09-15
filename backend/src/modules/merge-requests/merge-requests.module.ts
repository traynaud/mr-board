import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConnectionsModule } from '../connections/connections.module.js';
import { FavoritesModule } from '../favorites/favorites.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { UsersModule } from '../users/users.module.js';
import { MergeRequestApprover } from './entities/merge-request-approver.entity.js';
import { MergeRequestAssignee } from './entities/merge-request-assignee.entity.js';
import { MergeRequestReviewer } from './entities/merge-request-reviewer.entity.js';
import { MergeRequest } from './entities/merge-request.entity.js';
import { MergeRequestsController } from './merge-requests.controller.js';
import { MergeRequestsService } from './merge-requests.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MergeRequest,
      MergeRequestReviewer,
      MergeRequestAssignee,
      MergeRequestApprover,
    ]),
    UsersModule,
    ProjectsModule,
    SettingsModule,
    ConnectionsModule,
    FavoritesModule,
  ],
  controllers: [MergeRequestsController],
  providers: [MergeRequestsService],
  exports: [MergeRequestsService],
})
export class MergeRequestsModule {}
