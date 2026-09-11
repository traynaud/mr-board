import { Injectable, Logger } from '@nestjs/common';
import {
  GitlabAuthException,
  GitlabUnavailableException,
} from '../../common/exceptions';
import { GitlabTokenInfo } from './types/gitlab-token-info';
import { GitlabUser } from './types/gitlab-user';

/** Request timeout applied to every GitLab call (ms). */
export const GITLAB_TIMEOUT_MS = 15_000;

interface GetOptions {
  /** When true, a 404 resolves to `null` instead of throwing. */
  allowNotFound?: boolean;
}

/**
 * Thin client over the GitLab REST API v4. No business logic: it performs
 * authenticated requests and maps transport/HTTP failures to domain
 * exceptions. The token is never logged.
 */
@Injectable()
export class GitlabClientService {
  private readonly logger = new Logger(GitlabClientService.name);

  /**
   * `GET /api/v4/user` — the user owning the token.
   * @param baseUrl normalised instance URL (no trailing slash).
   * @param token personal or group access token.
   */
  async getCurrentUser(baseUrl: string, token: string): Promise<GitlabUser> {
    const user = await this.get<GitlabUser>(baseUrl, '/api/v4/user', token);
    return user as GitlabUser;
  }

  /**
   * `GET /api/v4/personal_access_tokens/self` — scopes and expiry of the token.
   * @returns `null` when the endpoint is unavailable (non-personal token, old instance).
   */
  getTokenInfo(
    baseUrl: string,
    token: string,
  ): Promise<GitlabTokenInfo | null> {
    return this.get<GitlabTokenInfo>(
      baseUrl,
      '/api/v4/personal_access_tokens/self',
      token,
      { allowNotFound: true },
    );
  }

  /**
   * Performs an authenticated GET and decodes the JSON body.
   * @throws GitlabAuthException on 401/403.
   * @throws GitlabUnavailableException on network error, timeout, non-JSON or other non-2xx.
   */
  protected async get<T>(
    baseUrl: string,
    path: string,
    token: string,
    options: GetOptions = {},
  ): Promise<T | null> {
    const url = `${baseUrl}${path}`;
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { 'PRIVATE-TOKEN': token, Accept: 'application/json' },
        signal: AbortSignal.timeout(GITLAB_TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.warn(`GitLab unreachable at ${url}: ${describe(error)}`);
      throw new GitlabUnavailableException();
    }
    if (response.status === 401 || response.status === 403) {
      throw new GitlabAuthException(
        `GitLab rejected the token (${response.status})`,
      );
    }
    if (response.status === 404 && options.allowNotFound) {
      return null;
    }
    if (!response.ok) {
      this.logger.warn(`GitLab ${url} responded ${response.status}`);
      throw new GitlabUnavailableException(
        `GitLab responded ${response.status}`,
      );
    }
    try {
      return (await response.json()) as T;
    } catch {
      throw new GitlabUnavailableException('GitLab returned an invalid body');
    }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.name : String(error);
}
