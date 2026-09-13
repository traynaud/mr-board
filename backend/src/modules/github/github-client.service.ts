import { Injectable, Logger } from '@nestjs/common';
import {
  BusinessValidationException,
  ForgeAuthException,
  ForgeRateLimitedException,
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
import { normalizeGitlabUrl } from '../gitlab/domain/normalize-gitlab-url';
import { hasRequiredScope } from './domain/check-github-token-scopes';
import { deriveGithubApiBases } from './domain/derive-github-api-bases';
import { normalizeGithubProjectPath } from './domain/normalize-github-project-path';
import { mapGraphqlPullRequest } from './mappers/map-graphql-pull-request';
import {
  GithubGraphqlPullRequestNode,
  GithubGraphqlPullRequestsPage,
  GithubGraphqlPullRequestsResponse,
} from './types/github-pull-request';
import { GithubRepo } from './types/github-repo';
import { GithubUser } from './types/github-user';

/** Request timeout applied to every GitHub call (ms). See RG-020-03. */
export const GITHUB_TIMEOUT_MS = 15_000;

/** Cap applied to a rate-limit wait, whichever header drives it. See RG-020-11. */
export const MAX_RATE_LIMIT_WAIT_MS = 30_000;

/** Page size used for the GraphQL pull requests query. See RG-020-07. */
const PULL_REQUESTS_PAGE_SIZE = 50;

const ACTOR_FIELDS = `
  __typename
  login
  avatarUrl
  url
  ... on User { name }
`;

const PULL_REQUESTS_QUERY = `
  query PullRequestsForSync($owner: String!, $name: String!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      pullRequests(states: OPEN, first: ${PULL_REQUESTS_PAGE_SIZE}, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          number
          title
          url
          isDraft
          createdAt
          updatedAt
          comments { totalCount }
          reviewThreads { totalCount }
          latestOpinionatedReviews(first: 20) {
            nodes {
              state
              author { ${ACTOR_FIELDS} }
            }
          }
          changedFiles
          additions
          deletions
          labels(first: 50) { nodes { name } }
          author { ${ACTOR_FIELDS} }
          assignees(first: 20) {
            nodes { ${ACTOR_FIELDS} }
          }
          reviewRequests(first: 20) {
            nodes {
              requestedReviewer {
                __typename
                ... on User { ${ACTOR_FIELDS} }
              }
            }
          }
          mergeable
          mergeStateStatus
          reviewDecision
          commits(last: 1) {
            nodes { commit { statusCheckRollup { state } } }
          }
        }
      }
    }
  }
`;

interface GraphqlAttempt {
  response: Response;
  body: GithubGraphqlPullRequestsResponse | null;
}

/**
 * GitHub implementation of the `ForgeClient` contract (RG-019-21, US-020): a
 * thin client over the GitHub REST/GraphQL APIs (github.com or GitHub
 * Enterprise Server). No business logic beyond mapping transport/HTTP
 * failures to domain exceptions. The token is never logged.
 */
@Injectable()
export class GithubClientService implements ForgeClient {
  private readonly logger = new Logger(GithubClientService.name);

  /**
   * RG-001-01: the origin is generic across forges — reuses the same pure
   * normaliser as GitLab (trims, keeps `scheme://host[:port]`, drops any path).
   */
  normalizeUrl(input: string): string | null {
    return normalizeGitlabUrl(input);
  }

  /**
   * RG-020-05: accepts a bare `owner/repo` path or a full GitHub URL.
   * @throws BusinessValidationException (`projects.invalidPath`) when the
   * result is not exactly two segments.
   */
  normalizePath(input: string): string | null {
    const path = normalizeGithubProjectPath(input);
    if (!path) {
      return null;
    }
    const segments = path.split('/').filter(Boolean);
    if (segments.length !== 2) {
      throw new BusinessValidationException(
        'projects.invalidPath',
        'Expected format: owner/repo',
      );
    }
    return path;
  }

  /**
   * Verifies a token against GitHub (RG-020-03): the identity it resolves to
   * (`GET /user`), its expiry (`GitHub-Authentication-Token-Expiration`
   * header, absent = no expiration) and, only for a classic PAT exposing
   * `X-OAuth-Scopes`, its scope. A fine-grained PAT never exposes scopes —
   * `scopeKnown` tells the caller no check could be performed.
   * @throws ForgeScopeException when a classic token lacks `repo`/`public_repo`.
   * @throws ForgeRateLimitedException on a 403 with `X-RateLimit-Remaining: 0`.
   * @throws ForgeAuthException / ForgeUnavailableException from the client.
   */
  async testConnection(url: string, token: string): Promise<ForgeTestResult> {
    const { rest } = deriveGithubApiBases(url);
    const response = await this.fetchRest(`${rest}/user`, token);
    if (response.status === 401) {
      throw new ForgeAuthException(
        `GitHub rejected the token (${response.status})`,
      );
    }
    if (
      response.status === 403 &&
      response.headers.get('X-RateLimit-Remaining') === '0'
    ) {
      throw new ForgeRateLimitedException();
    }
    if (!response.ok) {
      this.logger.warn(`GitHub ${rest}/user responded ${response.status}`);
      throw new ForgeUnavailableException(
        `GitHub responded ${response.status}`,
      );
    }
    let user: GithubUser;
    try {
      user = (await response.json()) as GithubUser;
    } catch {
      throw new ForgeUnavailableException('GitHub returned an invalid body');
    }
    const scopesHeader = response.headers.get('X-OAuth-Scopes');
    const scopeKnown = scopesHeader !== null;
    if (scopeKnown) {
      const scopes = scopesHeader
        .split(',')
        .map((scope) => scope.trim())
        .filter(Boolean);
      if (!hasRequiredScope(scopes)) {
        throw new ForgeScopeException();
      }
    }
    const expiresHeader = response.headers.get(
      'GitHub-Authentication-Token-Expiration',
    );
    return {
      username: user.login,
      name: user.name ?? user.login,
      avatarUrl: user.avatar_url,
      expiresAt: expiresHeader ? parseExpiryHeader(expiresHeader) : null,
      // RG-020-03: absent header means "no expiration", a known fact —
      // unlike GitLab, GitHub never leaves this genuinely undetermined.
      expirationKnown: true,
      scopeKnown,
    };
  }

  /**
   * `GET /repos/{owner}/{repo}` — `path` is already normalised to exactly
   * `owner/repo` by `normalizePath` before this is called.
   * @returns `null` on 404 (repository not found, RG-020-06).
   * @throws ForgeAuthException on 401/403 (private/inaccessible repo, RG-020-06 — reinterpreted as `projects.notFound` by the caller).
   */
  async resolveProject(
    url: string,
    token: string,
    path: string,
  ): Promise<ForgeProject | null> {
    const { rest } = deriveGithubApiBases(url);
    const response = await this.fetchRest(`${rest}/repos/${path}`, token);
    if (response.status === 404) {
      return null;
    }
    if (response.status === 401 || response.status === 403) {
      throw new ForgeAuthException(
        `GitHub rejected the token (${response.status})`,
      );
    }
    if (!response.ok) {
      this.logger.warn(
        `GitHub ${rest}/repos/${path} responded ${response.status}`,
      );
      throw new ForgeUnavailableException(
        `GitHub responded ${response.status}`,
      );
    }
    let repo: GithubRepo;
    try {
      repo = (await response.json()) as GithubRepo;
    } catch {
      throw new ForgeUnavailableException('GitHub returned an invalid body');
    }
    return {
      remoteProjectId: String(repo.id),
      pathWithNamespace: repo.full_name,
      webUrl: repo.html_url,
    };
  }

  /**
   * `POST {graphqlBase}` — open pull requests of a repository, paginated by
   * cursor (RG-020-07), mapped and mergeability-computed (RG-020-09,
   * RG-019-21). Aggregates every page into a single array.
   * @param options.deadlineAt epoch ms budget for the whole call, across all
   * pages and the single rate-limit wait (RG-020-11, RG-004-14).
   * @throws ForgeAuthException on 401/403.
   * @throws ForgeTimeoutException when `deadlineAt` is reached.
   * @throws ForgeUnavailableException on network error, invalid body, an
   * unresolved repository, an unsupported GraphQL schema (old GHES), a
   * rate limit still hit after one retry, or any other non-2xx response.
   */
  async fetchOpenMergeRequests(
    url: string,
    token: string,
    project: ForgeProject,
    options: FetchOpenMergeRequestsOptions,
  ): Promise<ForgeMergeRequest[]> {
    const { graphql } = deriveGithubApiBases(url);
    const [owner, name] = project.pathWithNamespace.split('/');
    const nodes: GithubGraphqlPullRequestNode[] = [];
    let cursor: string | null = null;
    do {
      if (Date.now() >= options.deadlineAt) {
        throw new ForgeTimeoutException();
      }
      const page = await this.fetchPullRequestsPage(
        graphql,
        token,
        owner,
        name,
        cursor,
        options.deadlineAt,
      );
      nodes.push(...page.nodes);
      cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    } while (cursor);
    return nodes.map(mapGraphqlPullRequest);
  }

  /** Fetches one page, retrying once after a rate-limit wait (RG-020-11). */
  private async fetchPullRequestsPage(
    graphqlBase: string,
    token: string,
    owner: string,
    name: string,
    cursor: string | null,
    deadlineAt: number,
  ): Promise<GithubGraphqlPullRequestsPage> {
    let attempt = await this.postGraphql(
      graphqlBase,
      token,
      deadlineAt,
      owner,
      name,
      cursor,
    );
    if (this.isRateLimited(attempt)) {
      await this.sleep(this.rateLimitDelayMs(attempt.response));
      if (Date.now() >= deadlineAt) {
        throw new ForgeTimeoutException();
      }
      attempt = await this.postGraphql(
        graphqlBase,
        token,
        deadlineAt,
        owner,
        name,
        cursor,
      );
      if (this.isRateLimited(attempt)) {
        throw new ForgeUnavailableException('GitHub rate limit exceeded twice');
      }
    }
    return this.parsePullRequestsPage(attempt);
  }

  /** RG-020-11: a 429, a 403 carrying rate-limit headers, or a 200 body with a `RATE_LIMITED` GraphQL error. */
  private isRateLimited(attempt: GraphqlAttempt): boolean {
    const { response, body } = attempt;
    if (response.status === 429) {
      return true;
    }
    if (
      response.status === 403 &&
      (response.headers.get('Retry-After') !== null ||
        response.headers.get('X-RateLimit-Remaining') === '0')
    ) {
      return true;
    }
    return (
      body?.errors?.some((error) => error.type === 'RATE_LIMITED') ?? false
    );
  }

  /** RG-020-11: `Retry-After` (secondary limit) takes precedence over `X-RateLimit-Reset`, both capped. */
  private rateLimitDelayMs(response: Response): number {
    const retryAfter = response.headers.get('Retry-After');
    if (retryAfter !== null) {
      const seconds = Number(retryAfter);
      return Math.min(
        Math.max(Number.isFinite(seconds) ? seconds : 0, 0) * 1000,
        MAX_RATE_LIMIT_WAIT_MS,
      );
    }
    const reset = response.headers.get('X-RateLimit-Reset');
    if (reset !== null) {
      const resetAtMs = Number(reset) * 1000;
      const delayMs = Number.isFinite(resetAtMs) ? resetAtMs - Date.now() : 0;
      return Math.min(Math.max(delayMs, 0), MAX_RATE_LIMIT_WAIT_MS);
    }
    return 0;
  }

  private parsePullRequestsPage(
    attempt: GraphqlAttempt,
  ): GithubGraphqlPullRequestsPage {
    const { response, body } = attempt;
    if (response.status === 401 || response.status === 403) {
      throw new ForgeAuthException(
        `GitHub rejected the token (${response.status})`,
      );
    }
    if (!response.ok) {
      this.logger.warn(`GitHub GraphQL responded ${response.status}`);
      throw new ForgeUnavailableException(
        `GitHub responded ${response.status}`,
      );
    }
    if (!body) {
      throw new ForgeUnavailableException('GitHub returned an invalid body');
    }
    const otherErrors = (body.errors ?? []).filter(
      (error) => error.type !== 'RATE_LIMITED',
    );
    const forbiddenError = otherErrors.find(
      (error) => error.type === 'FORBIDDEN',
    );
    if (forbiddenError) {
      // RG-020-12 : jeton fine-grained sans la permission requise sur cette ressource
      // (ex. « Pull requests » en lecture) — un 200 GraphQL peut porter ce refus.
      throw new ForgeAuthException(
        `GitHub rejected the token: ${forbiddenError.message}`,
      );
    }
    if (otherErrors.length > 0) {
      // RG-020-12 : GHES trop ancienne pour exposer un champ de la requête.
      throw new ForgeUnavailableException(
        `Unsupported GitHub version: ${otherErrors[0].message}`,
      );
    }
    const pullRequests = body.data?.repository?.pullRequests;
    if (!pullRequests) {
      // RG-020-12 : `repository` GraphQL nul — dépôt renommé/supprimé/inaccessible depuis sa résolution.
      throw new ForgeUnavailableException(
        'Repository not found or inaccessible',
      );
    }
    return pullRequests;
  }

  private async postGraphql(
    graphqlBase: string,
    token: string,
    deadlineAt: number,
    owner: string,
    name: string,
    cursor: string | null,
  ): Promise<GraphqlAttempt> {
    const remainingMs = Math.max(0, deadlineAt - Date.now());
    const timeoutMs = Math.min(GITHUB_TIMEOUT_MS, remainingMs);
    let response: Response;
    try {
      response = await fetch(graphqlBase, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: PULL_REQUESTS_QUERY,
          variables: { owner, name, cursor },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      this.logger.warn(
        `GitHub GraphQL unreachable at ${graphqlBase}: ${describe(error)}`,
      );
      throw new ForgeUnavailableException();
    }
    if (response.status !== 200) {
      return { response, body: null };
    }
    try {
      const body = (await response.json()) as GithubGraphqlPullRequestsResponse;
      return { response, body };
    } catch {
      throw new ForgeUnavailableException('GitHub returned an invalid body');
    }
  }

  /** Isolated for tests to mock away real waiting. */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Performs an authenticated GET against the REST API. Status-code
   * interpretation (401/403/404/...) is each caller's responsibility, since
   * `testConnection` and `resolveProject` branch on it differently.
   * @throws ForgeUnavailableException on network error or timeout.
   */
  private async fetchRest(url: string, token: string): Promise<Response> {
    try {
      return await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.warn(`GitHub unreachable at ${url}: ${describe(error)}`);
      throw new ForgeUnavailableException();
    }
  }
}

/** Parses `GitHub-Authentication-Token-Expiration` (e.g. `2027-03-12 10:00:00 UTC`), defensively. */
function parseExpiryHeader(value: string): string | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function describe(error: unknown): string {
  return error instanceof Error ? error.name : String(error);
}
