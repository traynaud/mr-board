import { Module } from '@nestjs/common';
import { GithubClientService } from './github-client.service';

/** GitHub implementation of the `ForgeClient` contract (RG-019-21, US-020), consumed via `ForgesModule`. */
@Module({
  providers: [GithubClientService],
  exports: [GithubClientService],
})
export class GithubModule {}
