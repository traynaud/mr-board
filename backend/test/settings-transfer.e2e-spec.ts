import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { GitlabClientService } from '../src/modules/gitlab/gitlab-client.service';
import { normalizeGitlabUrl } from '../src/modules/gitlab/domain/normalize-gitlab-url';
import { normalizeProjectPath } from '../src/modules/projects/domain/normalize-project-path';
import { createTestApp } from './utils/create-test-app';

interface Body {
  code?: string;
  message?: string[];
  version?: number;
  settings?: Record<string, unknown>;
  connections?: {
    type: string;
    name: string;
    url: string;
    meUsername: string | null;
  }[];
  projects?: {
    connection: string;
    pathWithNamespace: string;
    alias: string;
    color?: string | null;
  }[];
  projectsAdded?: number;
  projectsUpdated?: number;
  projectsSkipped?: { pathWithNamespace: string; reason: string }[];
  favorites?: { connection: string; pathWithNamespace: string; iid: number }[];
}
const body = (res: request.Response): Body => res.body as Body;

describe('SettingsTransfer (e2e)', () => {
  let app: INestApplication<App>;
  const gitlab = {
    normalizeUrl: jest.fn((url: string) => normalizeGitlabUrl(url)),
    normalizePath: jest.fn((path: string) => normalizeProjectPath(path)),
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
  const forgeProject = (path: string, id: string) => ({
    remoteProjectId: id,
    pathWithNamespace: path,
    webUrl: `https://gitlab.com/${path}`,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    gitlab.normalizeUrl.mockImplementation((url: string) =>
      normalizeGitlabUrl(url),
    );
    gitlab.resolveProject.mockImplementation(
      (_url: string, _token: string, path: string) =>
        Promise.resolve(
          path === 'equipe/backend-api' || path === 'equipe/front-web'
            ? forgeProject(path, path === 'equipe/backend-api' ? '42' : '7')
            : null,
        ),
    );
  });

  it('POST /connections should_create_a_connection_for_the_rest_of_this_suite', async () => {
    const res = await api().post('/api/v1/connections').send({
      type: 'gitlab',
      name: 'GitLab',
      url: 'https://gitlab.com',
      token: 'glpat-transfer-e2e-token',
    });

    expect(res.status).toBe(201);
  });

  it('POST /projects should_configure_one_repo_for_the_rest_of_this_suite', async () => {
    const res = await api()
      .post('/api/v1/projects')
      .send({ path: 'equipe/backend-api', alias: 'api' });

    expect(res.status).toBe(201);
  });

  it('GET /settings/export should_return_version_2_settings_connections_and_projects_without_a_token', async () => {
    const res = await api().get('/api/v1/settings/export');

    expect(res.status).toBe(200);
    expect(body(res).version).toBe(2);
    expect(body(res).settings).toEqual(
      expect.objectContaining({
        theme: 'system',
        highlightMe: true,
        language: 'fr',
      }),
    );
    expect(body(res).connections).toEqual([
      {
        type: 'gitlab',
        name: 'GitLab',
        url: 'https://gitlab.com',
        meUsername: null,
      },
    ]);
    expect(JSON.stringify(res.body)).not.toContain('transfer-e2e-token');
    expect(body(res).projects).toEqual([
      {
        connection: 'GitLab',
        pathWithNamespace: 'equipe/backend-api',
        alias: 'api',
        color: null,
      },
    ]);
  });

  it('POST /settings/import should_reject_a_file_without_a_version', async () => {
    const before = await api().get('/api/v1/settings');

    const res = await api()
      .post('/api/v1/settings/import')
      .send({ settings: {}, projects: [] });

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

  it('POST /settings/import (v1) should_replace_settings_update_an_alias_add_a_new_repo_and_never_touch_the_token', async () => {
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
      expect.objectContaining({ easyFiles: 12 }),
    );

    const connections = await api().get('/api/v1/connections');
    expect(connections.body).toEqual([
      expect.objectContaining({ name: 'GitLab', tokenConfigured: true }),
    ]);
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

  it('POST /settings/import (v1) should_collect_an_unresolvable_repo_in_skipped_without_failing_the_whole_import', async () => {
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

  it('POST /settings/import (v2) should_merge_a_connection_by_name_without_a_token_and_skip_a_repo_naming_an_unknown_connection', async () => {
    const res = await api()
      .post('/api/v1/settings/import')
      .send({
        version: 2,
        settings: {},
        connections: [
          {
            type: 'gitlab',
            name: 'gitlab.exemple.fr',
            url: 'https://gitlab.exemple.fr',
            meUsername: 'mdupont',
          },
        ],
        projects: [
          {
            connection: 'inexistante',
            pathWithNamespace: 'equipe/orphan',
            alias: 'orphan',
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(body(res).projectsSkipped).toEqual([
      { pathWithNamespace: 'equipe/orphan', reason: 'connections.unknown' },
    ]);
    const connections = await api().get('/api/v1/connections');
    expect(connections.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'gitlab.exemple.fr',
          tokenConfigured: false,
          meUsername: 'mdupont',
        }),
      ]),
    );
  });

  it('POST /settings/import (v2) should_import_and_export_a_repos_color_rg_025_08', async () => {
    const importRes = await api()
      .post('/api/v1/settings/import')
      .send({
        version: 2,
        settings: {},
        projects: [
          {
            connection: 'GitLab',
            pathWithNamespace: 'equipe/backend-api',
            alias: 'api',
            color: 'mint',
          },
        ],
      });
    expect(importRes.status).toBe(200);

    const exported = await api().get('/api/v1/settings/export');
    expect(body(exported).projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pathWithNamespace: 'equipe/backend-api',
          color: 'mint',
        }),
      ]),
    );
  });

  it('POST /settings/import should_import_the_theme_when_provided', async () => {
    const res = await api()
      .post('/api/v1/settings/import')
      .send({ version: 2, settings: { theme: 'dark' }, projects: [] });

    expect(res.status).toBe(200);
    expect(body(res).settings).toEqual(
      expect.objectContaining({ theme: 'dark' }),
    );
  });

  it('POST /settings/import should_reject_an_invalid_theme', async () => {
    const res = await api()
      .post('/api/v1/settings/import')
      .send({ version: 2, settings: { theme: 'blue' }, projects: [] });

    expect(res.status).toBe(400);
  });

  it('POST /settings/import should_import_highlight_me_when_provided', async () => {
    const res = await api()
      .post('/api/v1/settings/import')
      .send({ version: 2, settings: { highlightMe: false }, projects: [] });

    expect(res.status).toBe(200);
    expect(body(res).settings).toEqual(
      expect.objectContaining({ highlightMe: false }),
    );
  });

  it('POST /settings/import should_keep_highlight_me_unchanged_when_absent', async () => {
    // highlightMe was set to false by the previous test: an import omitting
    // the field must leave it untouched (RG-015-04 semantics, same as every
    // other importable field), not reset it to its true default.
    const res = await api()
      .post('/api/v1/settings/import')
      .send({ version: 2, settings: {}, projects: [] });

    expect(res.status).toBe(200);
    expect(body(res).settings).toEqual(
      expect.objectContaining({ highlightMe: false }),
    );
  });

  it('POST /settings/import should_import_the_language_when_provided', async () => {
    const res = await api()
      .post('/api/v1/settings/import')
      .send({ version: 2, settings: { language: 'en' }, projects: [] });

    expect(res.status).toBe(200);
    expect(body(res).settings).toEqual(
      expect.objectContaining({ language: 'en' }),
    );
  });

  it('POST /settings/import should_reject_an_invalid_language', async () => {
    const res = await api()
      .post('/api/v1/settings/import')
      .send({ version: 2, settings: { language: 'de' }, projects: [] });

    expect(res.status).toBe(400);
  });

  it('POST /settings/import (v2) should_import_and_export_a_favorite_rg_027_15', async () => {
    const importRes = await api()
      .post('/api/v1/settings/import')
      .send({
        version: 2,
        settings: {},
        projects: [],
        favorites: [
          {
            connection: 'GitLab',
            pathWithNamespace: 'equipe/backend-api',
            iid: 99,
          },
        ],
      });
    expect(importRes.status).toBe(200);

    const exported = await api().get('/api/v1/settings/export');
    expect(body(exported).favorites).toEqual(
      expect.arrayContaining([
        {
          connection: 'GitLab',
          pathWithNamespace: 'equipe/backend-api',
          iid: 99,
        },
      ]),
    );
  });

  it('POST /settings/import (v2) should_silently_ignore_a_favorite_for_an_unknown_repo_rg_027_15', async () => {
    const res = await api()
      .post('/api/v1/settings/import')
      .send({
        version: 2,
        settings: {},
        projects: [],
        favorites: [
          {
            connection: 'GitLab',
            pathWithNamespace: 'equipe/introuvable',
            iid: 1,
          },
        ],
      });

    expect(res.status).toBe(200);
    const exported = await api().get('/api/v1/settings/export');
    expect(body(exported).favorites).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pathWithNamespace: 'equipe/introuvable' }),
      ]),
    );
  });
});
