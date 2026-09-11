import { Logger } from '@nestjs/common';
import {
  GitlabAuthException,
  GitlabUnavailableException,
} from '../../common/exceptions';
import { GitlabClientService } from './gitlab-client.service';

const BASE = 'https://gitlab.example.com';
const TOKEN = 'glpat-secret-token-value';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
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
});
