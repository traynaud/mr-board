import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  ForgeRateLimitedException,
  ForgeScopeException,
} from '../src/common/exceptions';
import { normalizeGitlabUrl } from '../src/modules/gitlab/domain/normalize-gitlab-url';
import { GitlabClientService } from '../src/modules/gitlab/gitlab-client.service';
import { GithubClientService } from '../src/modules/github/github-client.service';
import { createTestApp } from './utils/create-test-app';

interface Body {
  id?: number;
  type?: string;
  name?: string;
  url?: string;
  tokenConfigured?: boolean;
  code?: string;
  username?: string;
  scopeKnown?: boolean;
}
const body = (res: request.Response): Body => res.body as Body;
const bodyList = (res: request.Response): Body[] => res.body as Body[];

describe('Connections (e2e)', () => {
  let app: INestApplication<App>;
  const gitlab = {
    normalizeUrl: jest.fn((url: string) => normalizeGitlabUrl(url)),
    normalizePath: jest.fn(),
    testConnection: jest.fn(),
    resolveProject: jest.fn(),
    fetchOpenMergeRequests: jest.fn(),
  };
  const github = {
    normalizeUrl: jest.fn((url: string) => normalizeGitlabUrl(url)),
    normalizePath: jest.fn(),
    testConnection: jest.fn(),
    resolveProject: jest.fn(),
    fetchOpenMergeRequests: jest.fn(),
  };

  beforeAll(async () => {
    app = await createTestApp((b) =>
      b
        .overrideProvider(GitlabClientService)
        .useValue(gitlab)
        .overrideProvider(GithubClientService)
        .useValue(github),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    gitlab.normalizeUrl.mockImplementation((url: string) =>
      normalizeGitlabUrl(url),
    );
    github.normalizeUrl.mockImplementation((url: string) =>
      normalizeGitlabUrl(url),
    );
  });

  const api = () => request(app.getHttpServer());

  it('GET /connections should_be_empty_before_any_connection_is_added', async () => {
    const res = await api().get('/api/v1/connections');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST /connections should_create_a_gitlab_connection', async () => {
    const res = await api().post('/api/v1/connections').send({
      type: 'gitlab',
      name: 'GitLab',
      url: 'https://gitlab.com',
      token: 'glpat-abcdwxyz',
    });

    expect(res.status).toBe(201);
    expect(body(res)).toEqual({
      id: expect.any(Number) as number,
      type: 'gitlab',
      name: 'GitLab',
      url: 'https://gitlab.com',
      tokenConfigured: true,
      tokenHint: 'wxyz',
      meUsername: null,
      projectsCount: 0,
    });
  });

  it('POST /connections should_create_a_github_connection', async () => {
    const res = await api().post('/api/v1/connections').send({
      type: 'github',
      name: 'github.com',
      url: 'https://github.com',
      token: 'ghp-abcdwxyz',
    });

    expect(res.status).toBe(201);
    expect(body(res)).toEqual(
      expect.objectContaining({
        type: 'github',
        name: 'github.com',
        url: 'https://github.com',
        tokenConfigured: true,
      }),
    );
  });

  it('POST /connections should_reject_a_name_containing_a_comma_rg_021_04', async () => {
    const res = await api().post('/api/v1/connections').send({
      type: 'gitlab',
      name: 'GitLab interne, secours',
      url: 'https://gitlab.exemple.fr',
      token: 'glpat-abcdwxyz',
    });

    expect(res.status).toBe(400);
  });

  it('PUT /connections/:id should_reject_a_name_containing_a_semicolon_rg_021_04', async () => {
    const created = await api().post('/api/v1/connections').send({
      type: 'gitlab',
      name: 'temp-connection',
      url: 'https://gitlab-temp.exemple.fr',
      token: 'glpat-abcdwxyz',
    });
    const id = body(created).id;

    const res = await api()
      .put(`/api/v1/connections/${id}`)
      .send({ name: 'temp;connection' });

    expect(res.status).toBe(400);

    await api().delete(`/api/v1/connections/${id}`);
  });

  it('GET /connections should_list_both_connections', async () => {
    const res = await api().get('/api/v1/connections');

    expect(res.status).toBe(200);
    expect(
      bodyList(res)
        .map((c) => c.type)
        .sort(),
    ).toEqual(['github', 'gitlab']);
  });

  it('POST /connections/test should_succeed_for_a_github_classic_token', async () => {
    github.testConnection.mockResolvedValue({
      username: 'mdupont',
      name: 'Marie Dupont',
      avatarUrl: null,
      expiresAt: null,
      expirationKnown: true,
      scopeKnown: true,
    });

    const res = await api().post('/api/v1/connections/test').send({
      type: 'github',
      url: 'https://github.com',
      token: 'ghp-abcdwxyz',
    });

    expect(res.status).toBe(201);
    expect(body(res)).toEqual({
      username: 'mdupont',
      name: 'Marie Dupont',
      avatarUrl: null,
      expiresAt: null,
      expirationKnown: true,
      scopeKnown: true,
    });
  });

  it('POST /connections/test should_report_scope_unknown_for_a_fine_grained_token', async () => {
    github.testConnection.mockResolvedValue({
      username: 'mdupont',
      name: 'Marie Dupont',
      avatarUrl: null,
      expiresAt: null,
      expirationKnown: true,
      scopeKnown: false,
    });

    const res = await api().post('/api/v1/connections/test').send({
      type: 'github',
      url: 'https://github.com',
      token: 'github_pat_abcdwxyz',
    });

    expect(res.status).toBe(201);
    expect(body(res).scopeKnown).toBe(false);
  });

  it('POST /connections/test should_map_a_forge_scope_exception_to_400', async () => {
    github.testConnection.mockRejectedValue(new ForgeScopeException());

    const res = await api().post('/api/v1/connections/test').send({
      type: 'github',
      url: 'https://github.com',
      token: 'ghp-abcdwxyz',
    });

    expect(res.status).toBe(400);
    expect(body(res).code).toBe('forge.scope');
  });

  it('POST /connections/test should_map_a_forge_rate_limited_exception_to_502', async () => {
    github.testConnection.mockRejectedValue(new ForgeRateLimitedException());

    const res = await api().post('/api/v1/connections/test').send({
      type: 'github',
      url: 'https://github.com',
      token: 'ghp-abcdwxyz',
    });

    expect(res.status).toBe(502);
    expect(body(res).code).toBe('forge.rateLimited');
  });

  it('PUT /connections/:id should_update_the_github_connection_name', async () => {
    const list = await api().get('/api/v1/connections');
    const id = bodyList(list).find((c) => c.type === 'github')?.id as number;

    const res = await api()
      .put(`/api/v1/connections/${id}`)
      .send({ name: 'GitHub principal' });

    expect(res.status).toBe(200);
    expect(body(res).name).toBe('GitHub principal');
  });

  it('DELETE /connections/:id should_remove_the_github_connection', async () => {
    const list = await api().get('/api/v1/connections');
    const id = bodyList(list).find((c) => c.type === 'github')?.id as number;

    const res = await api().delete(`/api/v1/connections/${id}`);

    expect(res.status).toBe(204);
    const after = await api().get('/api/v1/connections');
    expect(bodyList(after).map((c) => c.id)).not.toContain(id);
  });
});
