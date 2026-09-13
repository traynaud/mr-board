import { Module } from '@nestjs/common';
import { GitlabModule } from '../gitlab/gitlab.module';
import { ForgeClientFactory } from './forge-client.factory';

/**
 * Exposes `ForgeClientFactory`, the sole entry point other modules use to
 * reach a forge implementation (RG-019-21). Depends on `GitlabModule` to
 * inject `GitlabClientService` — `GitlabModule` itself never imports this
 * module back, only the `ForgeClient` type it implements.
 */
@Module({
  imports: [GitlabModule],
  providers: [ForgeClientFactory],
  exports: [ForgeClientFactory],
})
export class ForgesModule {}
