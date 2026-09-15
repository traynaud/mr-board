import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConnectionsModule } from '../connections/connections.module';
import { FavoritesModule } from '../favorites/favorites.module';
import { ProjectsModule } from '../projects/projects.module';
import { SettingsModule } from '../settings/settings.module';
import { UsersModule } from '../users/users.module';
import { MergeRequestApprover } from './entities/merge-request-approver.entity';
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
