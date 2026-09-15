import { Injectable } from '@nestjs/common';
import { GithubClientService } from '../github/github-client.service.js';
import { GitlabClientService } from '../gitlab/gitlab-client.service.js';
import { ForgeClient } from './forge-client.interface.js';
import { ConnectionType } from './types/connection-type.js';

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
