import { Injectable } from '@nestjs/common';
import { GithubClientService } from '../github/github-client.service';
import { GitlabClientService } from '../gitlab/gitlab-client.service';
import { ForgeClient } from './forge-client.interface';
import { ConnectionType } from './types/connection-type';

/**
 * Selects the `ForgeClient` implementation for a connection type
 * (RG-019-21). The only place in the codebase that knows which forges are
 * actually implemented.
 */
@Injectable()
export class ForgeClientFactory {
  constructor(
    private readonly gitlab: GitlabClientService,
    private readonly github: GithubClientService,
  ) {}

  forType(type: ConnectionType): ForgeClient {
    switch (type) {
      case 'gitlab':
        return this.gitlab;
      case 'github':
        return this.github;
    }
  }
}
