import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { GitlabClientService } from '../src/modules/gitlab/gitlab-client.service';
import { createTestApp } from './utils/create-test-app';

interface Body {
  code?: string;
  message?: string[];
  version?: number;
  settings?: Record<string, unknown>;
  projects?: { pathWithNamespace: string; alias: string }[];
  projectsAdded?: number;
  projectsUpdated?: number;
  projectsSkipped?: { pathWithNamespace: string; reason: string }[];
}
const body = (res: request.Response): Body => res.body as Body;

describe('SettingsTransfer (e2e)', () => {
  let app: INestApplication<App>;
  const gitlab = {
    getCurrentUser: jest.fn(),
    getTokenInfo: jest.fn(),
    getProject: jest.fn(),
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
  const gitlabProject = (path: string, id: number) => ({
    id,
    path_with_namespace: path,
    web_url: `https://gitlab.com/${path}`,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    gitlab.getProject.mockImplementation(
      (_url: string, _token: string, path: string) =>
        Promise.resolve(
          path === 'equipe/backend-api' || path === 'equipe/front-web'
            ? gitlabProject(path, path === 'equipe/backend-api' ? 42 : 7)
            : null,
        ),
    );
  });

  it('PUT /settings should_configure_a_token_for_the_rest_of_this_suite', async () => {
    const res = await api().put('/api/v1/settings').send({
      gitlabUrl: 'https://gitlab.com',
      gitlabToken: 'glpat-transfer-e2e-token',
    });

    expect(res.status).toBe(200);
  });

  it('POST /projects should_configure_one_repo_for_the_rest_of_this_suite', async () => {
    const res = await api()
      .post('/api/v1/projects')
      .send({ path: 'equipe/backend-api', alias: 'api' });

    expect(res.status).toBe(201);
  });

  it('GET /settings/export should_return_version_settings_without_token_and_projects', async () => {
    const res = await api().get('/api/v1/settings/export');

    expect(res.status).toBe(200);
    expect(body(res).version).toBe(1);
    expect(body(res).settings).toEqual(
      expect.objectContaining({
        gitlabUrl: 'https://gitlab.com',
        theme: 'system',
      }),
    );
    expect(body(res).settings).not.toHaveProperty('tokenConfigured');
    expect(body(res).settings).not.toHaveProperty('tokenHint');
    expect(JSON.stringify(res.body)).not.toContain('transfer-e2e-token');
    expect(body(res).projects).toEqual([
      { pathWithNamespace: 'equipe/backend-api', alias: 'api' },
    ]);
  });

  it('POST /settings/import should_reject_a_file_without_a_version', async () => {
    const before = await api().get('/api/v1/settings');

    const res = await api()
      .post('/api/v1/settings/import')
      .send({ settings: { gitlabUrl: 'https://gitlab.com' }, projects: [] });

    expect(res.status).toBe(400);
    const after = await api().get('/api/v1/settings');
    expect(after.body).toEqual(before.body);
  });

  it('POST /settings/import should_reject_a_settings_payload_carrying_a_token', async () => {
    const res = await api()
      .post('/api/v1/settings/import')
      .send({
        version: 1,
        settings: {
          gitlabUrl: 'https://gitlab.com',
          gitlabToken: 'glpat-should-be-rejected',
        },
        projects: [],
      });

    expect(res.status).toBe(400);
  });

  it('POST /settings/import should_replace_settings_update_an_alias_add_a_new_repo_and_never_touch_the_token', async () => {
    const res = await api()
      .post('/api/v1/settings/import')
      .send({
        version: 1,
        settings: { gitlabUrl: 'https://gitlab.com', easyFiles: 12 },
        projects: [
          { pathWithNamespace: 'equipe/backend-api', alias: 'backend' },
          { pathWithNamespace: 'equipe/front-web', alias: 'web' },
        ],
      });

    expect(res.status).toBe(200);
    expect(body(res).projectsAdded).toBe(1);
    expect(body(res).projectsUpdated).toBe(1);
    expect(body(res).projectsSkipped).toEqual([]);
    expect(body(res).settings).toEqual(
      expect.objectContaining({ easyFiles: 12, tokenConfigured: true }),
    );

    const projects = await api().get('/api/v1/projects');
    expect(projects.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pathWithNamespace: 'equipe/backend-api',
          alias: 'backend',
        }),
        expect.objectContaining({
          pathWithNamespace: 'equipe/front-web',
          alias: 'web',
        }),
      ]),
    );
  });

  it('POST /settings/import should_collect_an_unresolvable_repo_in_skipped_without_failing_the_whole_import', async () => {
    const res = await api()
      .post('/api/v1/settings/import')
      .send({
        version: 1,
        settings: { gitlabUrl: 'https://gitlab.com' },
        projects: [{ pathWithNamespace: 'equipe/introuvable', alias: 'x' }],
      });

    expect(res.status).toBe(200);
    expect(body(res).projectsSkipped).toEqual([
      { pathWithNamespace: 'equipe/introuvable', reason: 'projects.notFound' },
    ]);
  });

  it('POST /settings/import should_import_the_theme_when_provided', async () => {
    const res = await api()
      .post('/api/v1/settings/import')
      .send({
        version: 1,
        settings: { gitlabUrl: 'https://gitlab.com', theme: 'dark' },
        projects: [],
      });

    expect(res.status).toBe(200);
    expect(body(res).settings).toEqual(
      expect.objectContaining({ theme: 'dark' }),
    );
  });

  it('POST /settings/import should_reject_an_invalid_theme', async () => {
    const res = await api()
      .post('/api/v1/settings/import')
      .send({
        version: 1,
        settings: { gitlabUrl: 'https://gitlab.com', theme: 'blue' },
        projects: [],
      });

    expect(res.status).toBe(400);
  });
});
