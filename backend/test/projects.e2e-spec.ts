import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ForgeUnavailableException } from '../src/common/exceptions';
import { normalizeGitlabUrl } from '../src/modules/gitlab/domain/normalize-gitlab-url';
import { GitlabClientService } from '../src/modules/gitlab/gitlab-client.service';
import { createTestApp } from './utils/create-test-app';

interface Body {
  code?: string;
  message?: string[];
  id?: number;
  alias?: string;
  pathWithNamespace?: string;
  remoteProjectId?: string;
  connectionId?: number;
}
const body = (res: request.Response): Body => res.body as Body;
const bodyList = (res: request.Response): Body[] => res.body as Body[];

describe('Projects (e2e)', () => {
  let app: INestApplication<App>;
  const gitlab = {
    normalizeUrl: jest.fn((url: string) => normalizeGitlabUrl(url)),
    testConnection: jest.fn(),
    resolveProject: jest.fn(),
    fetchOpenMergeRequests: jest.fn(),
  };

  beforeAll(async () => {
    app = await createTestApp((b) =>
      b.overrideProvider(GitlabClientService).useValue(gitlab),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());
  const forgeProject = (
    overrides: Partial<{ id: string; path: string }> = {},
  ) => ({
    remoteProjectId: overrides.id ?? '42',
    pathWithNamespace: overrides.path ?? 'equipe/backend-api',
    webUrl: `https://gitlab.com/${overrides.path ?? 'equipe/backend-api'}`,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    gitlab.normalizeUrl.mockImplementation((url: string) =>
      normalizeGitlabUrl(url),
    );
    gitlab.resolveProject.mockResolvedValue(forgeProject());
  });

  it('GET /projects should_be_empty_before_any_repo_is_added', async () => {
    const res = await api().get('/api/v1/projects');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST /projects should_be_409_without_any_connection', async () => {
    const res = await api()
      .post('/api/v1/projects')
      .send({ path: 'equipe/backend-api' });

    expect(res.status).toBe(409);
    expect(body(res).code).toBe('connections.missing');
  });

  let connectionId: number;

  it('POST /connections should_create_a_connection_for_the_rest_of_this_suite', async () => {
    const res = await api().post('/api/v1/connections').send({
      type: 'gitlab',
      name: 'GitLab',
      url: 'https://gitlab.com',
      token: 'glpat-projects-e2e-token',
    });

    expect(res.status).toBe(201);
    connectionId = (res.body as { id: number }).id;
  });

  it('POST /projects should_add_a_repo_by_path_with_explicit_alias', async () => {
    const res = await api()
      .post('/api/v1/projects')
      .send({ path: 'equipe/backend-api', alias: 'api' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number) as number,
      connectionId,
      pathWithNamespace: 'equipe/backend-api',
      alias: 'api',
      remoteProjectId: '42',
    });

    const list = await api().get('/api/v1/projects');
    expect(list.body).toEqual([res.body]);
    expect(gitlab.resolveProject).toHaveBeenCalledWith(
      'https://gitlab.com',
      'glpat-projects-e2e-token',
      'equipe/backend-api',
    );
  });

  it('POST /projects should_add_a_repo_by_url_and_derive_alias', async () => {
    gitlab.resolveProject.mockResolvedValue(
      forgeProject({ id: '7', path: 'equipe/front-web' }),
    );

    const res = await api().post('/api/v1/projects').send({
      path: 'https://gitlab.exemple.fr/equipe/front-web/-/merge_requests',
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        pathWithNamespace: 'equipe/front-web',
        alias: 'front-web',
      }),
    );
  });

  it('POST /projects should_reject_duplicate_alias_case_insensitively', async () => {
    gitlab.resolveProject.mockResolvedValue(
      forgeProject({ id: '8', path: 'equipe/autre' }),
    );

    const res = await api()
      .post('/api/v1/projects')
      .send({ path: 'equipe/autre', alias: 'API' });

    expect(res.status).toBe(400);
    expect(body(res).code).toBe('projects.aliasDuplicate');
  });

  it('POST /projects should_reject_already_configured_project', async () => {
    const res = await api()
      .post('/api/v1/projects')
      .send({ path: 'equipe/backend-api', alias: 'another' });

    expect(res.status).toBe(409);
    expect(body(res).code).toBe('projects.alreadyConfigured');
  });

  let otherConnectionId: number;

  it('POST /connections should_create_a_second_connection_for_the_cross_connection_tests', async () => {
    const res = await api().post('/api/v1/connections').send({
      type: 'gitlab',
      name: 'gitlab.exemple.fr',
      url: 'https://gitlab.exemple.fr',
      token: 'glpat-second-connection-token',
    });

    expect(res.status).toBe(201);
    otherConnectionId = (res.body as { id: number }).id;
  });

  it('POST /projects should_allow_the_same_path_on_a_second_connection_with_a_different_alias', async () => {
    gitlab.resolveProject.mockResolvedValue(
      forgeProject({ id: '99', path: 'equipe/backend-api' }),
    );

    const res = await api().post('/api/v1/projects').send({
      path: 'equipe/backend-api',
      alias: 'api-interne',
      connectionId: otherConnectionId,
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number) as number,
      connectionId: otherConnectionId,
      pathWithNamespace: 'equipe/backend-api',
      alias: 'api-interne',
      remoteProjectId: '99',
    });
  });

  it('POST /projects should_reject_an_alias_already_used_on_another_connection', async () => {
    gitlab.resolveProject.mockResolvedValue(
      forgeProject({ id: '100', path: 'equipe/backend-api' }),
    );

    const res = await api().post('/api/v1/projects').send({
      path: 'equipe/backend-api',
      alias: 'api',
      connectionId: otherConnectionId,
    });

    expect(res.status).toBe(400);
    expect(body(res).code).toBe('projects.aliasDuplicate');
  });

  it('DELETE /connections/:id should_remove_the_second_connection_used_for_the_cross_connection_tests', async () => {
    // Restores the single-connection state the rest of this suite relies on
    // (RG-019-15 : the connection is implicit with only one configured).
    const res = await api().delete(`/api/v1/connections/${otherConnectionId}`);

    expect(res.status).toBe(204);
  });

  it('POST /projects should_reject_not_found_project', async () => {
    gitlab.resolveProject.mockResolvedValue(null);

    const res = await api()
      .post('/api/v1/projects')
      .send({ path: 'equipe/inexistant' });

    expect(res.status).toBe(400);
    expect(body(res).code).toBe('projects.notFound');
  });

  it('POST /projects should_map_forge_unavailable_to_502', async () => {
    gitlab.resolveProject.mockRejectedValue(new ForgeUnavailableException());

    const res = await api()
      .post('/api/v1/projects')
      .send({ path: 'equipe/hs' });

    expect(res.status).toBe(502);
    expect(body(res).code).toBe('forge.unavailable');
  });

  it('POST /projects should_reject_alias_with_a_comma', async () => {
    gitlab.resolveProject.mockResolvedValue(
      forgeProject({ id: '9', path: 'equipe/x' }),
    );

    const res = await api()
      .post('/api/v1/projects')
      .send({ path: 'equipe/x', alias: 'api,web' });

    expect(res.status).toBe(400);
  });

  it('POST /projects should_reject_alias_too_long', async () => {
    gitlab.resolveProject.mockResolvedValue(
      forgeProject({ id: '10', path: 'equipe/y' }),
    );

    const res = await api()
      .post('/api/v1/projects')
      .send({ path: 'equipe/y', alias: 'a'.repeat(21) });

    expect(res.status).toBe(400);
  });

  it('PUT /projects/:id should_rename_alias', async () => {
    const list = await api().get('/api/v1/projects');
    const id = bodyList(list).find((p) => p.alias === 'api')?.id as number;

    const res = await api()
      .put(`/api/v1/projects/${id}`)
      .send({ alias: 'back' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ id, alias: 'back' }));
  });

  it('PUT /projects/:id should_reject_rename_to_existing_alias', async () => {
    const list = await api().get('/api/v1/projects');
    const backId = bodyList(list).find((p) => p.alias === 'back')?.id as number;
    const otherAlias = bodyList(list).find((p) => p.id !== backId)
      ?.alias as string;

    const res = await api()
      .put(`/api/v1/projects/${backId}`)
      .send({ alias: otherAlias });

    expect(res.status).toBe(400);
    expect(body(res).code).toBe('projects.aliasDuplicate');
  });

  it('PUT /projects/:id should_allow_renaming_to_its_own_alias', async () => {
    const list = await api().get('/api/v1/projects');
    const project = bodyList(list).find((p) => p.alias === 'back') as Body;

    const res = await api()
      .put(`/api/v1/projects/${project.id}`)
      .send({ alias: 'back' });

    expect(res.status).toBe(200);
  });

  it('PUT /projects/:id should_be_404_for_unknown_id', async () => {
    const res = await api().put('/api/v1/projects/999999').send({ alias: 'x' });

    expect(res.status).toBe(404);
  });

  it('DELETE /projects/:id should_remove_the_repo', async () => {
    const list = await api().get('/api/v1/projects');
    const id = bodyList(list)[0].id as number;
    const countBefore = bodyList(list).length;

    const res = await api().delete(`/api/v1/projects/${id}`);

    expect(res.status).toBe(204);
    const after = await api().get('/api/v1/projects');
    expect(after.body).toHaveLength(countBefore - 1);
    expect((after.body as Body[]).some((p) => p.id === id)).toBe(false);
  });

  it('DELETE /projects/:id should_be_404_for_unknown_id', async () => {
    const res = await api().delete('/api/v1/projects/999999');

    expect(res.status).toBe(404);
  });
});
