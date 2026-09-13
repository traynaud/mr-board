import { Injectable } from '@nestjs/common';
import { ForgeTypeUnsupportedException } from '../../common/exceptions';
import { GitlabClientService } from '../gitlab/gitlab-client.service';
import { ForgeClient } from './forge-client.interface';
import { ConnectionType } from './types/connection-type';

/**
 * Selects the `ForgeClient` implementation for a connection type
 * (RG-019-21). The only place in the codebase that knows which forges are
 * actually implemented — `github` is a declared `ConnectionType` (RG-019-01)
 * but has no implementation until US-020.
 */
@Injectable()
export class ForgeClientFactory {
  constructor(private readonly gitlab: GitlabClientService) {}

  /**
   * @throws ForgeTypeUnsupportedException for a `ConnectionType` not implemented yet.
   */
  forType(type: ConnectionType): ForgeClient {
    switch (type) {
      case 'gitlab':
        return this.gitlab;
      case 'github':
        throw new ForgeTypeUnsupportedException();
    }
  }
}
