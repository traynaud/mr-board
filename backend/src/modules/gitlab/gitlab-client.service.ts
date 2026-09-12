import { Injectable, Logger } from '@nestjs/common';
import {
  GitlabAuthException,
  GitlabTimeoutException,
  GitlabUnavailableException,
} from '../../common/exceptions';
import {
  GitlabGraphqlMergeRequestNode,
  GitlabGraphqlMergeRequestsPage,
  GitlabGraphqlMergeRequestsResponse,
} from './types/gitlab-merge-request';
import { GitlabProject } from './types/gitlab-project';
import { GitlabTokenInfo } from './types/gitlab-token-info';
import { GitlabUser } from './types/gitlab-user';

/** Request timeout applied to every GitLab call (ms). */
export const GITLAB_TIMEOUT_MS = 15_000;

/** Cap applied to a `Retry-After` wait on a 429 response (ms). See RG-004-13. */
export const MAX_RETRY_AFTER_MS = 30_000;

/** Page size used for the GraphQL merge requests query. */
const MERGE_REQUESTS_PAGE_SIZE = 100;

const MERGE_REQUESTS_QUERY = `
  query MergeRequestsForSync($fullPath: ID!, $cursor: String) {
    project(fullPath: $fullPath) {
      mergeRequests(state: opened, first: ${MERGE_REQUESTS_PAGE_SIZE}, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          iid
          title
          webUrl
          draft
          createdAt
          updatedAt
          userNotesCount
          approved
          labels { nodes { title } }
          diffStatsSummary { fileCount additions deletions }
          author { id username name avatarUrl webUrl }
          reviewers { nodes { id username name avatarUrl webUrl } }
          assignees { nodes { id username name avatarUrl webUrl } }
        }
      }
    }
  }
`;

interface GetOptions {
  /** When true, a 404 resolves to `null` instead of throwing. */
  allowNotFound?: boolean;
}

export interface GetOpenMergeRequestsOptions {
  /** Epoch ms after which this project's sync is aborted. See RG-004-14. */
  deadlineAt: number;
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
   * `GET /api/v4/projects/:id` — resolves a project by its full path
   * (`groupe/sous-groupe/projet`), URL-encoded as a single path segment.
   * @returns `null` on 404 (project not found or not visible with this token).
   * @throws GitlabAuthException on 401/403 (up to the caller to retranslate, RG-003-03).
   */
  getProject(
    baseUrl: string,
    token: string,
    pathWithNamespace: string,
  ): Promise<GitlabProject | null> {
    return this.get<GitlabProject>(
      baseUrl,
      `/api/v4/projects/${encodeURIComponent(pathWithNamespace)}`,
      token,
      { allowNotFound: true },
    );
  }

  /**
   * `POST /api/graphql` — open merge requests of a project, paginated by
   * cursor (RG-004-01). Aggregates every page into a single array.
   * @param options.deadlineAt epoch ms budget for the whole call, across all
   * pages and the single retry-after wait (RG-004-14). Checked before each page.
   * @throws GitlabAuthException on 401/403.
   * @throws GitlabTimeoutException when `deadlineAt` is reached.
   * @throws GitlabUnavailableException on network error, invalid body, a
   * second consecutive 429, or any other non-2xx response.
   */
  async getOpenMergeRequests(
    baseUrl: string,
    token: string,
    pathWithNamespace: string,
    options: GetOpenMergeRequestsOptions,
  ): Promise<GitlabGraphqlMergeRequestNode[]> {
    const nodes: GitlabGraphqlMergeRequestNode[] = [];
    let cursor: string | null = null;
    do {
      if (Date.now() >= options.deadlineAt) {
        throw new GitlabTimeoutException();
      }
      const page = await this.fetchMergeRequestsPage(
        baseUrl,
        token,
        pathWithNamespace,
        cursor,
        options.deadlineAt,
      );
      nodes.push(...page.nodes);
      cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    } while (cursor);
    return nodes;
  }

  /** Fetches one page, retrying once after a 429's `Retry-After` delay. */
  private async fetchMergeRequestsPage(
    baseUrl: string,
    token: string,
    pathWithNamespace: string,
    cursor: string | null,
    deadlineAt: number,
  ): Promise<GitlabGraphqlMergeRequestsPage> {
    let response = await this.postGraphql(
      baseUrl,
      token,
      deadlineAt,
      pathWithNamespace,
      cursor,
    );
    if (response.status === 429) {
      await this.waitForRateLimit(response);
      if (Date.now() >= deadlineAt) {
        throw new GitlabTimeoutException();
      }
      response = await this.postGraphql(
        baseUrl,
        token,
        deadlineAt,
        pathWithNamespace,
        cursor,
      );
      if (response.status === 429) {
        throw new GitlabUnavailableException(
          'GitLab rate limit exceeded twice',
        );
      }
    }
    return this.parseMergeRequestsResponse(response);
  }

  private async postGraphql(
    baseUrl: string,
    token: string,
    deadlineAt: number,
    fullPath: string,
    cursor: string | null,
  ): Promise<Response> {
    const remainingMs = Math.max(0, deadlineAt - Date.now());
    const timeoutMs = Math.min(GITLAB_TIMEOUT_MS, remainingMs);
    try {
      return await fetch(`${baseUrl}/api/graphql`, {
        method: 'POST',
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query: MERGE_REQUESTS_QUERY,
          variables: { fullPath, cursor },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      this.logger.warn(
        `GitLab GraphQL unreachable at ${baseUrl}: ${describe(error)}`,
      );
      throw new GitlabUnavailableException();
    }
  }

  private async parseMergeRequestsResponse(
    response: Response,
  ): Promise<GitlabGraphqlMergeRequestsPage> {
    if (response.status === 401 || response.status === 403) {
      throw new GitlabAuthException(
        `GitLab rejected the token (${response.status})`,
      );
    }
    if (!response.ok) {
      this.logger.warn(`GitLab GraphQL responded ${response.status}`);
      throw new GitlabUnavailableException(
        `GitLab responded ${response.status}`,
      );
    }
    let body: GitlabGraphqlMergeRequestsResponse;
    try {
      body = (await response.json()) as GitlabGraphqlMergeRequestsResponse;
    } catch {
      throw new GitlabUnavailableException('GitLab returned an invalid body');
    }
    const mergeRequests = body.data?.project?.mergeRequests;
    if (!mergeRequests) {
      throw new GitlabUnavailableException(
        'GitLab GraphQL response has no project data',
      );
    }
    return mergeRequests;
  }

  /** Waits the `Retry-After` duration of a 429 response, capped (RG-004-13). */
  private async waitForRateLimit(response: Response): Promise<void> {
    const header = response.headers.get('Retry-After');
    const seconds = header ? Number(header) : 0;
    const delayMs = Math.min(
      Math.max(Number.isFinite(seconds) ? seconds : 0, 0) * 1000,
      MAX_RETRY_AFTER_MS,
    );
    await this.sleep(delayMs);
  }

  /** Isolated for tests to mock away real waiting. */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
