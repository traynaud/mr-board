import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module';
import { GitlabModule } from '../gitlab/gitlab.module';
import { ForgeClientFactory } from './forge-client.factory';

/**
 * Exposes `ForgeClientFactory`, the sole entry point other modules use to
 * reach a forge implementation (RG-019-21). Depends on `GitlabModule`/
 * `GithubModule` to inject their clients — neither imports this module
 * back, only the `ForgeClient` type they implement.
 */
@Module({
  imports: [GitlabModule, GithubModule],
  providers: [ForgeClientFactory],
  exports: [ForgeClientFactory],
})
export class ForgesModule {}
