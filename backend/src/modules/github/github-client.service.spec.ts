import { Logger } from '@nestjs/common';
import {
  BusinessValidationException,
  ForgeAuthException,
  ForgeRateLimitedException,
  ForgeScopeException,
  ForgeTimeoutException,
  ForgeUnavailableException,
} from '../../common/exceptions';
import { ForgeProject } from '../forges/types/forge-project';
import { GithubClientService } from './github-client.service';
import { GithubGraphqlPullRequestNode } from './types/github-pull-request';

const BASE = 'https://github.com';
const GHES_BASE = 'https://github.exemple.fr';
const TOKEN = 'ghp_secret-token-value';
const PROJECT: ForgeProject = {
  remoteProjectId: '42',
  pathWithNamespace: 'equipe/api',
  webUrl: `${BASE}/equipe/api`,
};

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function actor(login: string, overrides: Record<string, unknown> = {}) {
  return {
    __typename: 'User',
    login,
    avatarUrl: null,
    url: `${BASE}/${login}`,
    name: null,
    ...overrides,
  };
}

function pullRequestNode(
  number: number,
  overrides: Partial<GithubGraphqlPullRequestNode> = {},
): GithubGraphqlPullRequestNode {
  return {
    id: `PR_${number}`,
    number,
    title: `PR ${number}`,
    url: `${BASE}/equipe/api/pull/${number}`,
    isDraft: false,
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-01T10:00:00Z',
    comments: { totalCount: 0 },
    reviewThreads: { totalCount: 0 },
    latestOpinionatedReviews: { nodes: [] },
    changedFiles: 1,
    additions: 1,
    deletions: 0,
    labels: { nodes: [] },
    author: actor('mdupont'),
    assignees: { nodes: [] },
    reviewRequests: { nodes: [] },
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'CLEAN',
    reviewDecision: null,
    commits: { nodes: [{ commit: { statusCheckRollup: null } }] },
    ...overrides,
  };
}

function graphqlPageResponse(
  nodes: GithubGraphqlPullRequestNode[],
  pageInfo: { hasNextPage: boolean; endCursor: string | null } = {
    hasNextPage: false,
    endCursor: null,
  },
): Response {
  return jsonResponse(200, {
    data: { repository: { pullRequests: { pageInfo, nodes } } },
  });
}

describe('GithubClientService', () => {
  let service: GithubClientService;
  let fetchSpy: jest.SpyInstance<Promise<Response>, Parameters<typeof fetch>>;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new GithubClientService();
    fetchSpy = jest.spyOn(globalThis, 'fetch');
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    jest
      .spyOn(
        service as unknown as { sleep(ms: number): Promise<void> },
        'sleep',
      )
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    warnSpy.mockRestore();
  });

  describe('normalizeUrl', () => {
    it('should_delegate_to_the_generic_origin_normalizer', () => {
      expect(service.normalizeUrl('https://github.com/')).toBe(
        'https://github.com',
      );
      expect(service.normalizeUrl('not a url')).toBeNull();
    });
  });

  describe('normalizePath', () => {
    it('should_accept_an_owner_repo_path', () => {
      expect(service.normalizePath('equipe/front-web')).toBe(
        'equipe/front-web',
      );
    });

    it('should_extract_the_path_from_a_url_and_strip_pulls', () => {
      expect(
        service.normalizePath('https://github.com/Equipe/Front-Web/pulls'),
      ).toBe('Equipe/Front-Web');
    });

    it('should_return_null_for_an_empty_input', () => {
      expect(service.normalizePath('')).toBeNull();
    });

    it('should_throw_invalid_path_for_more_than_two_segments', () => {
      expect(() => service.normalizePath('equipe/sous/front-web')).toThrow(
        BusinessValidationException,
      );
    });

    it('should_throw_invalid_path_for_a_single_segment', () => {
      expect(() => service.normalizePath('equipe')).toThrow(
        BusinessValidationException,
      );
    });
  });

  describe('testConnection', () => {
    it('should_resolve_the_identity_with_bearer_auth', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse(
          200,
          { login: 'mdupont', name: 'Marie Dupont', avatar_url: null },
          {
            'X-OAuth-Scopes': 'repo, read:org',
            'GitHub-Authentication-Token-Expiration': '2027-03-12 10:00:00 UTC',
          },
        ),
      );

      const result = await service.testConnection(BASE, TOKEN);

      expect(result).toEqual({
        username: 'mdupont',
        name: 'Marie Dupont',
        avatarUrl: null,
        expiresAt: new Date('2027-03-12 10:00:00 UTC').toISOString(),
        expirationKnown: true,
        scopeKnown: true,
      });
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.github.com/user');
      expect((init.headers as Record<string, string>)['Authorization']).toBe(
        `Bearer ${TOKEN}`,
      );
    });

    it('should_report_no_expiration_when_the_header_is_absent', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse(
          200,
          { login: 'mdupont', name: 'Marie Dupont', avatar_url: null },
          { 'X-OAuth-Scopes': 'repo' },
        ),
      );

      const result = await service.testConnection(BASE, TOKEN);

      expect(result.expiresAt).toBeNull();
      expect(result.expirationKnown).toBe(true);
    });

    it('should_skip_the_scope_check_for_a_fine_grained_token', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse(200, {
          login: 'mdupont',
          name: 'Marie Dupont',
          avatar_url: null,
        }),
      );

      const result = await service.testConnection(BASE, TOKEN);

      expect(result.scopeKnown).toBe(false);
    });

    it('should_fall_back_to_the_login_when_name_is_null', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse(200, { login: 'mdupont', name: null, avatar_url: null }),
      );

      const result = await service.testConnection(BASE, TOKEN);

      expect(result.name).toBe('mdupont');
    });

    it('should_throw_scope_exception_when_a_classic_token_lacks_repo', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse(
          200,
          { login: 'mdupont', name: 'Marie Dupont', avatar_url: null },
          { 'X-OAuth-Scopes': 'read:user' },
        ),
      );

      await expect(service.testConnection(BASE, TOKEN)).rejects.toBeInstanceOf(
        ForgeScopeException,
      );
    });

    it('should_throw_auth_exception_on_401', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(401, {}));

      await expect(service.testConnection(BASE, TOKEN)).rejects.toBeInstanceOf(
        ForgeAuthException,
      );
    });

    it('should_throw_rate_limited_exception_on_403_with_remaining_zero', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse(403, {}, { 'X-RateLimit-Remaining': '0' }),
      );

      await expect(service.testConnection(BASE, TOKEN)).rejects.toBeInstanceOf(
        ForgeRateLimitedException,
      );
    });

    it('should_throw_unavailable_on_a_plain_403', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(403, {}));

      await expect(service.testConnection(BASE, TOKEN)).rejects.toBeInstanceOf(
        ForgeUnavailableException,
      );
    });

    it('should_throw_unavailable_on_network_error_without_leaking_the_token', async () => {
      fetchSpy.mockRejectedValue(new TypeError('fetch failed'));

      await expect(service.testConnection(BASE, TOKEN)).rejects.toBeInstanceOf(
        ForgeUnavailableException,
      );
      expect(warnSpy).toHaveBeenCalledWith(expect.not.stringContaining(TOKEN));
    });

    it('should_throw_unavailable_on_invalid_json', async () => {
      fetchSpy.mockResolvedValue(new Response('<html>', { status: 200 }));

      await expect(service.testConnection(BASE, TOKEN)).rejects.toBeInstanceOf(
        ForgeUnavailableException,
      );
    });

    it('should_derive_the_ghes_api_base', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse(200, { login: 'mdupont', name: null, avatar_url: null }),
      );

      await service.testConnection(GHES_BASE, TOKEN);

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${GHES_BASE}/api/v3/user`);
    });
  });

  describe('resolveProject', () => {
    it('should_resolve_a_repository_by_owner_repo', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse(200, {
          id: 42,
          full_name: 'equipe/front-web',
          html_url: `${BASE}/equipe/front-web`,
        }),
      );

      await expect(
        service.resolveProject(BASE, TOKEN, 'equipe/front-web'),
      ).resolves.toEqual({
        remoteProjectId: '42',
        pathWithNamespace: 'equipe/front-web',
        webUrl: `${BASE}/equipe/front-web`,
      });
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.github.com/repos/equipe/front-web',
        expect.anything(),
      );
    });

    it('should_return_null_when_the_repository_is_not_found', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(404, {}));

      await expect(
        service.resolveProject(BASE, TOKEN, 'equipe/inexistant'),
      ).resolves.toBeNull();
    });

    it.each([401, 403])(
      'should_throw_auth_exception_on_%i_forbidden_repository',
      async (status) => {
        fetchSpy.mockResolvedValue(jsonResponse(status, {}));

        await expect(
          service.resolveProject(BASE, TOKEN, 'equipe/prive'),
        ).rejects.toBeInstanceOf(ForgeAuthException);
      },
    );

    it('should_throw_unavailable_on_server_error', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(500, {}));

      await expect(
        service.resolveProject(BASE, TOKEN, 'equipe/api'),
      ).rejects.toBeInstanceOf(ForgeUnavailableException);
    });

    it('should_throw_unavailable_on_invalid_json', async () => {
      fetchSpy.mockResolvedValue(new Response('<html>', { status: 200 }));

      await expect(
        service.resolveProject(BASE, TOKEN, 'equipe/api'),
      ).rejects.toBeInstanceOf(ForgeUnavailableException);
    });
  });

  describe('fetchOpenMergeRequests', () => {
    const deadlineAt = () => Date.now() + 60_000;

    it('should_post_a_graphql_query_with_owner_and_name_variables', async () => {
      fetchSpy.mockResolvedValue(graphqlPageResponse([pullRequestNode(1)]));

      await service.fetchOpenMergeRequests(BASE, TOKEN, PROJECT, {
        deadlineAt: deadlineAt(),
      });

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.github.com/graphql');
      expect(init.method).toBe('POST');
      expect((init.headers as Record<string, string>)['Authorization']).toBe(
        `Bearer ${TOKEN}`,
      );
      const body = JSON.parse(init.body as string) as {
        variables: { owner: string; name: string; cursor: string | null };
      };
      expect(body.variables).toEqual({
        owner: 'equipe',
        name: 'api',
        cursor: null,
      });
    });

    it('should_map_every_node_to_a_forge_merge_request', async () => {
      fetchSpy.mockResolvedValue(graphqlPageResponse([pullRequestNode(1)]));

      const [mr] = await service.fetchOpenMergeRequests(BASE, TOKEN, PROJECT, {
        deadlineAt: deadlineAt(),
      });

      expect(mr).toEqual(
        expect.objectContaining({
          remoteId: 'PR_1',
          iid: 1,
          mergeStatus: { state: 'mergeable', reasons: [] },
        }),
      );
    });

    it('should_aggregate_every_page_following_the_cursor', async () => {
      fetchSpy
        .mockResolvedValueOnce(
          graphqlPageResponse([pullRequestNode(1), pullRequestNode(2)], {
            hasNextPage: true,
            endCursor: 'cursor-1',
          }),
        )
        .mockResolvedValueOnce(graphqlPageResponse([pullRequestNode(3)]));

      const mergeRequests = await service.fetchOpenMergeRequests(
        BASE,
        TOKEN,
        PROJECT,
        { deadlineAt: deadlineAt() },
      );

      expect(mergeRequests.map((mr) => mr.iid)).toEqual([1, 2, 3]);
      const [, secondInit] = fetchSpy.mock.calls[1] as [string, RequestInit];
      const secondBody = JSON.parse(secondInit.body as string) as {
        variables: { cursor: string | null };
      };
      expect(secondBody.variables.cursor).toBe('cursor-1');
    });

    it.each([401, 403])('should_throw_auth_exception_on_%i', async (status) => {
      fetchSpy.mockResolvedValue(jsonResponse(status, {}));

      await expect(
        service.fetchOpenMergeRequests(BASE, TOKEN, PROJECT, {
          deadlineAt: deadlineAt(),
        }),
      ).rejects.toBeInstanceOf(ForgeAuthException);
    });

    it('should_retry_once_after_a_429_and_succeed', async () => {
      fetchSpy
        .mockResolvedValueOnce(jsonResponse(429, {}))
        .mockResolvedValueOnce(graphqlPageResponse([pullRequestNode(1)]));

      const mergeRequests = await service.fetchOpenMergeRequests(
        BASE,
        TOKEN,
        PROJECT,
        { deadlineAt: deadlineAt() },
      );

      expect(mergeRequests).toHaveLength(1);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should_retry_once_after_a_secondary_limit_403_with_retry_after', async () => {
      fetchSpy
        .mockResolvedValueOnce(jsonResponse(403, {}, { 'Retry-After': '2' }))
        .mockResolvedValueOnce(graphqlPageResponse([pullRequestNode(1)]));

      await service.fetchOpenMergeRequests(BASE, TOKEN, PROJECT, {
        deadlineAt: deadlineAt(),
      });

      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should_retry_once_after_a_primary_limit_403_with_remaining_zero', async () => {
      fetchSpy
        .mockResolvedValueOnce(
          jsonResponse(
            403,
            {},
            {
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 1),
            },
          ),
        )
        .mockResolvedValueOnce(graphqlPageResponse([pullRequestNode(1)]));

      await service.fetchOpenMergeRequests(BASE, TOKEN, PROJECT, {
        deadlineAt: deadlineAt(),
      });

      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should_retry_once_after_a_200_body_reporting_rate_limited', async () => {
      fetchSpy
        .mockResolvedValueOnce(
          jsonResponse(200, { errors: [{ type: 'RATE_LIMITED' }] }),
        )
        .mockResolvedValueOnce(graphqlPageResponse([pullRequestNode(1)]));

      await service.fetchOpenMergeRequests(BASE, TOKEN, PROJECT, {
        deadlineAt: deadlineAt(),
      });

      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should_fail_the_repo_when_rate_limited_twice_in_a_row', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(429, {}));

      await expect(
        service.fetchOpenMergeRequests(BASE, TOKEN, PROJECT, {
          deadlineAt: deadlineAt(),
        }),
      ).rejects.toBeInstanceOf(ForgeUnavailableException);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should_throw_timeout_when_the_deadline_is_already_passed', async () => {
      await expect(
        service.fetchOpenMergeRequests(BASE, TOKEN, PROJECT, {
          deadlineAt: Date.now() - 1,
        }),
      ).rejects.toBeInstanceOf(ForgeTimeoutException);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should_throw_unavailable_with_a_descriptive_message_on_a_schema_error', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse(200, {
          errors: [{ message: "Field 'mergeStateStatus' doesn't exist" }],
        }),
      );

      await expect(
        service.fetchOpenMergeRequests(BASE, TOKEN, PROJECT, {
          deadlineAt: deadlineAt(),
        }),
      ).rejects.toThrow(/mergeStateStatus/);
    });

    it('should_throw_forge_auth_when_graphql_reports_a_forbidden_error', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse(200, {
          errors: [
            {
              type: 'FORBIDDEN',
              message: 'Resource not accessible by personal access token',
            },
          ],
        }),
      );

      await expect(
        service.fetchOpenMergeRequests(BASE, TOKEN, PROJECT, {
          deadlineAt: deadlineAt(),
        }),
      ).rejects.toBeInstanceOf(ForgeAuthException);
    });

    it('should_throw_unavailable_when_the_repository_is_null', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse(200, { data: { repository: null } }),
      );

      await expect(
        service.fetchOpenMergeRequests(BASE, TOKEN, PROJECT, {
          deadlineAt: deadlineAt(),
        }),
      ).rejects.toBeInstanceOf(ForgeUnavailableException);
    });

    it('should_throw_unavailable_on_network_error', async () => {
      fetchSpy.mockRejectedValue(new TypeError('fetch failed'));

      await expect(
        service.fetchOpenMergeRequests(BASE, TOKEN, PROJECT, {
          deadlineAt: deadlineAt(),
        }),
      ).rejects.toBeInstanceOf(ForgeUnavailableException);
    });

    it('should_throw_unavailable_on_invalid_json', async () => {
      fetchSpy.mockResolvedValue(new Response('<html>', { status: 200 }));

      await expect(
        service.fetchOpenMergeRequests(BASE, TOKEN, PROJECT, {
          deadlineAt: deadlineAt(),
        }),
      ).rejects.toBeInstanceOf(ForgeUnavailableException);
    });
  });
});
