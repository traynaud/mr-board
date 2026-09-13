import { Injectable, Logger } from '@nestjs/common';
import {
  ForgeAuthException,
  ForgeScopeException,
  ForgeTimeoutException,
  ForgeUnavailableException,
} from '../../common/exceptions';
import {
  FetchOpenMergeRequestsOptions,
  ForgeClient,
} from '../forges/forge-client.interface';
import { ForgeMergeRequest } from '../forges/types/forge-merge-request';
import { ForgeProject } from '../forges/types/forge-project';
import { ForgeTestResult } from '../forges/types/forge-test-result';
import { hasRequiredScope } from './domain/check-token-scopes';
import { normalizeGitlabUrl } from './domain/normalize-gitlab-url';
import { normalizeProjectPath } from '../projects/domain/normalize-project-path';
import { mapGraphqlMergeRequest } from './mappers/map-graphql-merge-request';
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
          detailedMergeStatus
          conflicts
          headPipeline { status }
          approvalsRequired
          approvalsLeft
          resolvableDiscussionsCount
          resolvedDiscussionsCount
        }
      }
    }
  }
`;

interface GetOptions {
  /** When true, a 404 resolves to `null` instead of throwing. */
  allowNotFound?: boolean;
}

/**
 * GitLab implementation of the `ForgeClient` contract (RG-019-21): a thin
 * client over the GitLab REST/GraphQL APIs. No business logic beyond
 * mapping transport/HTTP failures to domain exceptions. The token is never
 * logged.
 */
@Injectable()
export class GitlabClientService implements ForgeClient {
  private readonly logger = new Logger(GitlabClientService.name);

  /** RG-001-01: trims, keeps only `scheme://host[:port]`, drops any path. */
  normalizeUrl(input: string): string | null {
    return normalizeGitlabUrl(input);
  }

  /**
   * RG-003-01: accepts a bare path or a full GitLab URL, any depth of
   * (sub)groups — GitLab enforces no fixed segment count, unlike GitHub
   * (RG-020-05), so this never throws.
   */
  normalizePath(input: string): string | null {
    return normalizeProjectPath(input);
  }

  /**
   * Verifies a token against GitLab (RG-001-04) : the identity it resolves
   * to (`GET /api/v4/user`) and, when available, its scopes and expiry
   * (`GET /api/v4/personal_access_tokens/self`). The caller is responsible
   * for ensuring `token` is non-empty (`ConnectionsService`).
   * @throws ForgeScopeException when the token lacks `read_api`/`api`.
   * @throws ForgeAuthException / ForgeUnavailableException from the client.
   */
  async testConnection(
    baseUrl: string,
    token: string,
  ): Promise<ForgeTestResult> {
    const user = await this.get<GitlabUser>(baseUrl, '/api/v4/user', token);
    const info = await this.get<GitlabTokenInfo>(
      baseUrl,
      '/api/v4/personal_access_tokens/self',
      token,
      { allowNotFound: true },
    );
    if (info && !hasRequiredScope(info.scopes)) {
      throw new ForgeScopeException();
    }
    return {
      username: (user as GitlabUser).username,
      name: (user as GitlabUser).name,
      avatarUrl: (user as GitlabUser).avatar_url ?? null,
      expiresAt: info?.expires_at ?? null,
      expirationKnown: info !== null,
      scopeKnown: info !== null,
    };
  }

  /**
   * `GET /api/v4/projects/:id` — resolves a project by its full path
   * (`groupe/sous-groupe/projet`), URL-encoded as a single path segment.
   * @returns `null` on 404 (project not found or not visible with this token).
   * @throws ForgeAuthException on 401/403 (up to the caller to retranslate, RG-003-03).
   */
  async resolveProject(
    baseUrl: string,
    token: string,
    path: string,
  ): Promise<ForgeProject | null> {
    const project = await this.get<GitlabProject>(
      baseUrl,
      `/api/v4/projects/${encodeURIComponent(path)}`,
      token,
      { allowNotFound: true },
    );
    return project
      ? {
          remoteProjectId: String(project.id),
          pathWithNamespace: project.path_with_namespace,
          webUrl: project.web_url,
        }
      : null;
  }

  /**
   * `POST /api/graphql` — open merge requests of a project, paginated by
   * cursor (RG-004-01), mapped and mergeability-computed (RG-017-*,
   * RG-019-21). Aggregates every page into a single array.
   * @param options.deadlineAt epoch ms budget for the whole call, across all
   * pages and the single retry-after wait (RG-004-14). Checked before each page.
   * @throws ForgeAuthException on 401/403.
   * @throws ForgeTimeoutException when `deadlineAt` is reached.
   * @throws ForgeUnavailableException on network error, invalid body, a
   * second consecutive 429, or any other non-2xx response.
   */
  async fetchOpenMergeRequests(
    baseUrl: string,
    token: string,
    project: ForgeProject,
    options: FetchOpenMergeRequestsOptions,
  ): Promise<ForgeMergeRequest[]> {
    const nodes: GitlabGraphqlMergeRequestNode[] = [];
    let cursor: string | null = null;
    do {
      if (Date.now() >= options.deadlineAt) {
        throw new ForgeTimeoutException();
      }
      const page = await this.fetchMergeRequestsPage(
        baseUrl,
        token,
        project.pathWithNamespace,
        cursor,
        options.deadlineAt,
      );
      nodes.push(...page.nodes);
      cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    } while (cursor);
    return nodes.map(mapGraphqlMergeRequest);
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
        throw new ForgeTimeoutException();
      }
      response = await this.postGraphql(
        baseUrl,
        token,
        deadlineAt,
        pathWithNamespace,
        cursor,
      );
      if (response.status === 429) {
        throw new ForgeUnavailableException('GitLab rate limit exceeded twice');
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
      throw new ForgeUnavailableException();
    }
  }

  private async parseMergeRequestsResponse(
    response: Response,
  ): Promise<GitlabGraphqlMergeRequestsPage> {
    if (response.status === 401 || response.status === 403) {
      throw new ForgeAuthException(
        `GitLab rejected the token (${response.status})`,
      );
    }
    if (!response.ok) {
      this.logger.warn(`GitLab GraphQL responded ${response.status}`);
      throw new ForgeUnavailableException(
        `GitLab responded ${response.status}`,
      );
    }
    let body: GitlabGraphqlMergeRequestsResponse;
    try {
      body = (await response.json()) as GitlabGraphqlMergeRequestsResponse;
    } catch {
      throw new ForgeUnavailableException('GitLab returned an invalid body');
    }
    const mergeRequests = body.data?.project?.mergeRequests;
    if (!mergeRequests) {
      throw new ForgeUnavailableException(
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
   * @throws ForgeAuthException on 401/403.
   * @throws ForgeUnavailableException on network error, timeout, non-JSON or other non-2xx.
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
      throw new ForgeUnavailableException();
    }
    if (response.status === 401 || response.status === 403) {
      throw new ForgeAuthException(
        `GitLab rejected the token (${response.status})`,
      );
    }
    if (response.status === 404 && options.allowNotFound) {
      return null;
    }
    if (!response.ok) {
      this.logger.warn(`GitLab ${url} responded ${response.status}`);
      throw new ForgeUnavailableException(
        `GitLab responded ${response.status}`,
      );
    }
    try {
      return (await response.json()) as T;
    } catch {
      throw new ForgeUnavailableException('GitLab returned an invalid body');
    }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.name : String(error);
}
