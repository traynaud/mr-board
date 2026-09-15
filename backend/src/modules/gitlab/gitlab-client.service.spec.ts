import { Logger } from '@nestjs/common';
import {
  ForgeAuthException,
  ForgeScopeException,
  ForgeTimeoutException,
  ForgeUnavailableException,
} from '../../common/exceptions/index.js';
import { ForgeProject } from '../forges/types/forge-project.js';
import { GitlabGraphqlMergeRequestNode } from './types/gitlab-merge-request.js';
import { GitlabClientService } from './gitlab-client.service.js';

const BASE = 'https://gitlab.example.com';
const TOKEN = 'glpat-secret-token-value';
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

function graphqlNode(
  iid: number,
  overrides: Partial<GitlabGraphqlMergeRequestNode> = {},
): GitlabGraphqlMergeRequestNode {
  return {
    id: `gid://gitlab/MergeRequest/${iid}`,
    iid: String(iid),
    title: `MR ${iid}`,
    webUrl: `${BASE}/equipe/api/-/merge_requests/${iid}`,
    draft: false,
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-01T10:00:00Z',
    userNotesCount: 0,
    approvedBy: { nodes: [] },
    labels: { nodes: [] },
    diffStatsSummary: { fileCount: 1, additions: 1, deletions: 0 },
    author: {
      id: 'gid://gitlab/User/1',
      username: 'mdupont',
      name: 'Marie Dupont',
      avatarUrl: null,
      webUrl: `${BASE}/mdupont`,
    },
    reviewers: { nodes: [] },
    assignees: { nodes: [] },
    detailedMergeStatus: 'MERGEABLE',
    conflicts: false,
    headPipeline: { status: 'SUCCESS' },
    approvalsRequired: 0,
    approvalsLeft: 0,
    resolvableDiscussionsCount: 0,
    resolvedDiscussionsCount: 0,
    ...overrides,
  };
}

function graphqlPageResponse(
  nodes: GitlabGraphqlMergeRequestNode[],
  pageInfo: { hasNextPage: boolean; endCursor: string | null } = {
    hasNextPage: false,
    endCursor: null,
  },
): Response {
  return jsonResponse(200, {
    data: { project: { mergeRequests: { pageInfo, nodes } } },
  });
}

describe('GitlabClientService', () => {
  let service: GitlabClientService;
  let fetchSpy: jest.SpyInstance<Promise<Response>, Parameters<typeof fetch>>;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new GitlabClientService();
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
    it('should_delegate_to_the_pure_normalizer', () => {
      expect(service.normalizeUrl('https://gitlab.exemple.fr/')).toBe(
        'https://gitlab.exemple.fr',
      );
      expect(service.normalizeUrl('not a url')).toBeNull();
    });
  });

  describe('normalizePath', () => {
    it('should_delegate_to_the_pure_normalizer_without_a_segment_count_limit', () => {
      expect(service.normalizePath('equipe/sous-groupe/projet')).toBe(
        'equipe/sous-groupe/projet',
      );
      expect(service.normalizePath('')).toBeNull();
    });
  });

  describe('testConnection', () => {
    it('should_resolve_the_identity_with_private_token_header', async () => {
      fetchSpy
        .mockResolvedValueOnce(
          jsonResponse(200, {
            id: 1,
            username: 'mdupont',
            name: 'Marie Dupont',
            avatar_url: null,
          }),
        )
        .mockResolvedValueOnce(jsonResponse(404, {}));

      await expect(service.testConnection(BASE, TOKEN)).resolves.toEqual({
        username: 'mdupont',
        name: 'Marie Dupont',
        avatarUrl: null,
        expiresAt: null,
        expirationKnown: false,
        scopeKnown: false,
      });

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE}/api/v4/user`);
      expect((init.headers as Record<string, string>)['PRIVATE-TOKEN']).toBe(
        TOKEN,
      );
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it('should_report_the_token_expiry_and_scopes_when_available', async () => {
      fetchSpy
        .mockResolvedValueOnce(
          jsonResponse(200, {
            id: 1,
            username: 'mdupont',
            name: 'Marie Dupont',
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse(200, {
            id: 7,
            scopes: ['read_api'],
            expires_at: '2027-03-12',
          }),
        );

      await expect(service.testConnection(BASE, TOKEN)).resolves.toEqual(
        expect.objectContaining({
          expiresAt: '2027-03-12',
          expirationKnown: true,
          scopeKnown: true,
        }),
      );
    });

    it('should_throw_scope_exception_when_the_token_lacks_read_api', async () => {
      fetchSpy
        .mockResolvedValueOnce(
          jsonResponse(200, {
            id: 1,
            username: 'mdupont',
            name: 'Marie Dupont',
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse(200, { id: 7, scopes: ['read_user'], expires_at: null }),
        );

      await expect(service.testConnection(BASE, TOKEN)).rejects.toBeInstanceOf(
        ForgeScopeException,
      );
    });

    it.each([401, 403])('should_throw_auth_exception_on_%i', async (status) => {
      fetchSpy.mockResolvedValue(jsonResponse(status, { message: 'nope' }));

      await expect(service.testConnection(BASE, TOKEN)).rejects.toBeInstanceOf(
        ForgeAuthException,
      );
    });

    it('should_throw_unavailable_on_404_for_user', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(404, {}));

      await expect(service.testConnection(BASE, TOKEN)).rejects.toBeInstanceOf(
        ForgeUnavailableException,
      );
    });

    it('should_throw_unavailable_on_server_error', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(500, {}));

      await expect(service.testConnection(BASE, TOKEN)).rejects.toBeInstanceOf(
        ForgeUnavailableException,
      );
    });

    it('should_throw_unavailable_on_network_error_without_leaking_token', async () => {
      fetchSpy.mockRejectedValue(new TypeError('fetch failed'));

      await expect(service.testConnection(BASE, TOKEN)).rejects.toBeInstanceOf(
        ForgeUnavailableException,
      );
      expect(warnSpy).toHaveBeenCalledWith(expect.not.stringContaining(TOKEN));
    });

    it('should_throw_unavailable_on_timeout', async () => {
      const abort = new Error('timeout');
      abort.name = 'TimeoutError';
      fetchSpy.mockRejectedValue(abort);

      await expect(service.testConnection(BASE, TOKEN)).rejects.toBeInstanceOf(
        ForgeUnavailableException,
      );
    });

    it('should_throw_unavailable_on_invalid_json', async () => {
      fetchSpy.mockResolvedValue(new Response('<html>', { status: 200 }));

      await expect(service.testConnection(BASE, TOKEN)).rejects.toBeInstanceOf(
        ForgeUnavailableException,
      );
    });
  });

  describe('resolveProject', () => {
    it('should_resolve_a_project_by_url_encoded_path', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse(200, {
          id: 42,
          path_with_namespace: 'equipe/backend-api',
          web_url: `${BASE}/equipe/backend-api`,
        }),
      );

      await expect(
        service.resolveProject(BASE, TOKEN, 'equipe/backend-api'),
      ).resolves.toEqual({
        remoteProjectId: '42',
        pathWithNamespace: 'equipe/backend-api',
        webUrl: `${BASE}/equipe/backend-api`,
      });
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE}/api/v4/projects/equipe%2Fbackend-api`,
        expect.anything(),
      );
    });

    it('should_return_null_when_project_is_not_found', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(404, {}));

      await expect(
        service.resolveProject(BASE, TOKEN, 'equipe/inexistant'),
      ).resolves.toBeNull();
    });

    it('should_throw_auth_exception_on_forbidden_project', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(403, {}));

      await expect(
        service.resolveProject(BASE, TOKEN, 'equipe/prive'),
      ).rejects.toBeInstanceOf(ForgeAuthException);
    });
  });

  describe('fetchOpenMergeRequests', () => {
    const deadlineAt = () => Date.now() + 60_000;

    it('should_post_a_graphql_query_with_the_private_token_header', async () => {
      fetchSpy.mockResolvedValue(graphqlPageResponse([graphqlNode(1)]));

      await service.fetchOpenMergeRequests(BASE, TOKEN, PROJECT, {
        deadlineAt: deadlineAt(),
      });

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE}/api/graphql`);
      expect(init.method).toBe('POST');
      expect((init.headers as Record<string, string>)['PRIVATE-TOKEN']).toBe(
        TOKEN,
      );
      const body = JSON.parse(init.body as string) as {
        variables: { fullPath: string; cursor: string | null };
      };
      expect(body.variables).toEqual({ fullPath: 'equipe/api', cursor: null });
    });

    it('should_map_every_node_to_a_forge_merge_request_with_its_merge_status', async () => {
      fetchSpy.mockResolvedValue(graphqlPageResponse([graphqlNode(1)]));

      const [mr] = await service.fetchOpenMergeRequests(BASE, TOKEN, PROJECT, {
        deadlineAt: deadlineAt(),
      });

      expect(mr).toEqual(
        expect.objectContaining({
          remoteId: '1',
          iid: 1,
          mergeStatus: { state: 'mergeable', reasons: [] },
        }),
      );
    });

    it('should_aggregate_every_page_following_the_cursor', async () => {
      fetchSpy
        .mockResolvedValueOnce(
          graphqlPageResponse([graphqlNode(1), graphqlNode(2)], {
            hasNextPage: true,
            endCursor: 'cursor-1',
          }),
        )
        .mockResolvedValueOnce(graphqlPageResponse([graphqlNode(3)]));

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
        .mockResolvedValueOnce(jsonResponse(429, {}, { 'Retry-After': '2' }))
        .mockResolvedValueOnce(graphqlPageResponse([graphqlNode(1)]));

      const mergeRequests = await service.fetchOpenMergeRequests(
        BASE,
        TOKEN,
        PROJECT,
        { deadlineAt: deadlineAt() },
      );

      expect(mergeRequests).toHaveLength(1);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should_fail_the_project_on_two_consecutive_429', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(429, {}, { 'Retry-After': '1' }));

      await expect(
        service.fetchOpenMergeRequests(BASE, TOKEN, PROJECT, {
          deadlineAt: deadlineAt(),
        }),
      ).rejects.toBeInstanceOf(ForgeUnavailableException);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should_throw_timeout_exception_when_the_deadline_is_already_passed', async () => {
      await expect(
        service.fetchOpenMergeRequests(BASE, TOKEN, PROJECT, {
          deadlineAt: Date.now() - 1,
        }),
      ).rejects.toBeInstanceOf(ForgeTimeoutException);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should_throw_timeout_exception_when_the_deadline_passes_between_pages', async () => {
      const dateSpy = jest.spyOn(Date, 'now');
      dateSpy.mockReturnValueOnce(1_000).mockReturnValue(100_000);
      fetchSpy.mockResolvedValue(
        graphqlPageResponse([graphqlNode(1)], {
          hasNextPage: true,
          endCursor: 'cursor-1',
        }),
      );

      await expect(
        service.fetchOpenMergeRequests(BASE, TOKEN, PROJECT, {
          deadlineAt: 5_000,
        }),
      ).rejects.toBeInstanceOf(ForgeTimeoutException);

      dateSpy.mockRestore();
    });

    it('should_throw_unavailable_when_the_response_has_no_project_data', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse(200, { data: { project: null } }),
      );

      await expect(
        service.fetchOpenMergeRequests(BASE, TOKEN, PROJECT, {
          deadlineAt: deadlineAt(),
        }),
      ).rejects.toBeInstanceOf(ForgeUnavailableException);
    });

    it('should_throw_unavailable_on_a_non_2xx_response', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(500, {}));

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
  });
});
