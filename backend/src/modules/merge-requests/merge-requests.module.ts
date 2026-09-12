import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { MergeRequestAssignee } from './entities/merge-request-assignee.entity';
import { MergeRequestReviewer } from './entities/merge-request-reviewer.entity';
import { MergeRequest } from './entities/merge-request.entity';
import { MergeRequestsService } from './merge-requests.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MergeRequest,
      MergeRequestReviewer,
      MergeRequestAssignee,
    ]),
    UsersModule,
  ],
  providers: [MergeRequestsService],
  exports: [MergeRequestsService],
})
export class MergeRequestsModule {}
