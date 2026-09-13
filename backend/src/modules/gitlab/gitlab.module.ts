import { Module } from '@nestjs/common';
import { GitlabClientService } from './gitlab-client.service';

/** GitLab implementation of the `ForgeClient` contract (RG-019-21), consumed via `ForgesModule`. */
@Module({
  providers: [GitlabClientService],
  exports: [GitlabClientService],
})
export class GitlabModule {}
