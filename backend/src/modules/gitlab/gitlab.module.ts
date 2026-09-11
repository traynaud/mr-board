import { Module } from '@nestjs/common';
import { GitlabClientService } from './gitlab-client.service';

/** GitLab API client, shared by settings, projects and sync modules. */
@Module({
  providers: [GitlabClientService],
  exports: [GitlabClientService],
})
export class GitlabModule {}
