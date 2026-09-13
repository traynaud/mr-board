import { Logger } from '@nestjs/common';
import {
  GitlabAuthException,
  GitlabTimeoutException,
  GitlabUnavailableException,
} from '../../common/exceptions';
import { GitlabGraphqlMergeRequestNode } from './types/gitlab-merge-request';
import { GitlabClientService } from './gitlab-client.service';

const BASE = 'https://gitlab.example.com';
const TOKEN = 'glpat-secret-token-value';

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
    approved: false,
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

  it('should_get_current_user_with_private_token_header', async () => {
    const user = { id: 1, username: 'mdupont', name: 'Marie Dupont' };
    fetchSpy.mockResolvedValue(jsonResponse(200, user));

    await expect(service.getCurrentUser(BASE, TOKEN)).resolves.toEqual(user);

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/v4/user`);
    expect((init.headers as Record<string, string>)['PRIVATE-TOKEN']).toBe(
      TOKEN,
    );
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('should_get_token_info', async () => {
    const info = { id: 7, scopes: ['read_api'], expires_at: '2027-03-12' };
    fetchSpy.mockResolvedValue(jsonResponse(200, info));

    await expect(service.getTokenInfo(BASE, TOKEN)).resolves.toEqual(info);
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/api/v4/personal_access_tokens/self`,
      expect.anything(),
    );
  });

  it('should_return_null_when_token_info_endpoint_is_missing', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(404, { message: '404' }));

    await expect(service.getTokenInfo(BASE, TOKEN)).resolves.toBeNull();
  });

  it('should_get_project_by_url_encoded_path', async () => {
    const project = {
      id: 42,
      path_with_namespace: 'equipe/backend-api',
      web_url: `${BASE}/equipe/backend-api`,
    };
    fetchSpy.mockResolvedValue(jsonResponse(200, project));

    await expect(
      service.getProject(BASE, TOKEN, 'equipe/backend-api'),
    ).resolves.toEqual(project);
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/api/v4/projects/equipe%2Fbackend-api`,
      expect.anything(),
    );
  });

  it('should_return_null_when_project_is_not_found', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(404, {}));

    await expect(
      service.getProject(BASE, TOKEN, 'equipe/inexistant'),
    ).resolves.toBeNull();
  });

  it('should_throw_auth_exception_on_forbidden_project', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(403, {}));

    await expect(
      service.getProject(BASE, TOKEN, 'equipe/prive'),
    ).rejects.toBeInstanceOf(GitlabAuthException);
  });

  it.each([401, 403])('should_throw_auth_exception_on_%i', async (status) => {
    fetchSpy.mockResolvedValue(jsonResponse(status, { message: 'nope' }));

    await expect(service.getCurrentUser(BASE, TOKEN)).rejects.toBeInstanceOf(
      GitlabAuthException,
    );
  });

  it('should_throw_unavailable_on_404_for_user', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(404, {}));

    await expect(service.getCurrentUser(BASE, TOKEN)).rejects.toBeInstanceOf(
      GitlabUnavailableException,
    );
  });

  it('should_throw_unavailable_on_server_error', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(500, {}));

    await expect(service.getCurrentUser(BASE, TOKEN)).rejects.toBeInstanceOf(
      GitlabUnavailableException,
    );
  });

  it('should_throw_unavailable_on_network_error_without_leaking_token', async () => {
    fetchSpy.mockRejectedValue(new TypeError('fetch failed'));

    await expect(service.getCurrentUser(BASE, TOKEN)).rejects.toBeInstanceOf(
      GitlabUnavailableException,
    );
    expect(warnSpy).toHaveBeenCalledWith(expect.not.stringContaining(TOKEN));
  });

  it('should_throw_unavailable_on_timeout', async () => {
    const abort = new Error('timeout');
    abort.name = 'TimeoutError';
    fetchSpy.mockRejectedValue(abort);

    await expect(service.getCurrentUser(BASE, TOKEN)).rejects.toBeInstanceOf(
      GitlabUnavailableException,
    );
  });

  it('should_throw_unavailable_on_invalid_json', async () => {
    fetchSpy.mockResolvedValue(new Response('<html>', { status: 200 }));

    await expect(service.getCurrentUser(BASE, TOKEN)).rejects.toBeInstanceOf(
      GitlabUnavailableException,
    );
  });

  describe('getOpenMergeRequests', () => {
    const deadlineAt = () => Date.now() + 60_000;

    it('should_post_a_graphql_query_with_the_private_token_header', async () => {
      fetchSpy.mockResolvedValue(graphqlPageResponse([graphqlNode(1)]));

      await service.getOpenMergeRequests(BASE, TOKEN, 'equipe/api', {
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

    it('should_aggregate_every_page_following_the_cursor', async () => {
      fetchSpy
        .mockResolvedValueOnce(
          graphqlPageResponse([graphqlNode(1), graphqlNode(2)], {
            hasNextPage: true,
            endCursor: 'cursor-1',
          }),
        )
        .mockResolvedValueOnce(graphqlPageResponse([graphqlNode(3)]));

      const nodes = await service.getOpenMergeRequests(
        BASE,
        TOKEN,
        'equipe/api',
        {
          deadlineAt: deadlineAt(),
        },
      );

      expect(nodes.map((n) => n.iid)).toEqual(['1', '2', '3']);
      const [, secondInit] = fetchSpy.mock.calls[1] as [string, RequestInit];
      const secondBody = JSON.parse(secondInit.body as string) as {
        variables: { cursor: string | null };
      };
      expect(secondBody.variables.cursor).toBe('cursor-1');
    });

    it.each([401, 403])('should_throw_auth_exception_on_%i', async (status) => {
      fetchSpy.mockResolvedValue(jsonResponse(status, {}));

      await expect(
        service.getOpenMergeRequests(BASE, TOKEN, 'equipe/api', {
          deadlineAt: deadlineAt(),
        }),
      ).rejects.toBeInstanceOf(GitlabAuthException);
    });

    it('should_retry_once_after_a_429_and_succeed', async () => {
      fetchSpy
        .mockResolvedValueOnce(jsonResponse(429, {}, { 'Retry-After': '2' }))
        .mockResolvedValueOnce(graphqlPageResponse([graphqlNode(1)]));

      const nodes = await service.getOpenMergeRequests(
        BASE,
        TOKEN,
        'equipe/api',
        {
          deadlineAt: deadlineAt(),
        },
      );

      expect(nodes).toHaveLength(1);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should_fail_the_project_on_two_consecutive_429', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(429, {}, { 'Retry-After': '1' }));

      await expect(
        service.getOpenMergeRequests(BASE, TOKEN, 'equipe/api', {
          deadlineAt: deadlineAt(),
        }),
      ).rejects.toBeInstanceOf(GitlabUnavailableException);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should_throw_timeout_exception_when_the_deadline_is_already_passed', async () => {
      await expect(
        service.getOpenMergeRequests(BASE, TOKEN, 'equipe/api', {
          deadlineAt: Date.now() - 1,
        }),
      ).rejects.toBeInstanceOf(GitlabTimeoutException);
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
        service.getOpenMergeRequests(BASE, TOKEN, 'equipe/api', {
          deadlineAt: 5_000,
        }),
      ).rejects.toBeInstanceOf(GitlabTimeoutException);

      dateSpy.mockRestore();
    });

    it('should_throw_unavailable_when_the_response_has_no_project_data', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse(200, { data: { project: null } }),
      );

      await expect(
        service.getOpenMergeRequests(BASE, TOKEN, 'equipe/api', {
          deadlineAt: deadlineAt(),
        }),
      ).rejects.toBeInstanceOf(GitlabUnavailableException);
    });

    it('should_throw_unavailable_on_a_non_2xx_response', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(500, {}));

      await expect(
        service.getOpenMergeRequests(BASE, TOKEN, 'equipe/api', {
          deadlineAt: deadlineAt(),
        }),
      ).rejects.toBeInstanceOf(GitlabUnavailableException);
    });

    it('should_throw_unavailable_on_network_error', async () => {
      fetchSpy.mockRejectedValue(new TypeError('fetch failed'));

      await expect(
        service.getOpenMergeRequests(BASE, TOKEN, 'equipe/api', {
          deadlineAt: deadlineAt(),
        }),
      ).rejects.toBeInstanceOf(GitlabUnavailableException);
    });
  });
});
