import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  GitlabAuthException,
  GitlabUnavailableException,
} from '../src/common/exceptions';
import { GitlabClientService } from '../src/modules/gitlab/gitlab-client.service';
import { createTestApp } from './utils/create-test-app';

const TOKEN = 'glpat-e2e-secret-token-wxyz';

interface Body {
  code?: string;
  message?: string[];
  tokenConfigured?: boolean;
  refreshIntervalMin?: number;
  pauseWhenHidden?: boolean;
}
const body = (res: request.Response): Body => res.body as Body;

describe('Settings (e2e)', () => {
  let app: INestApplication<App>;
  const gitlab = { getCurrentUser: jest.fn(), getTokenInfo: jest.fn() };

  beforeAll(async () => {
    app = await createTestApp((b) =>
      b.overrideProvider(GitlabClientService).useValue(gitlab),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    gitlab.getCurrentUser.mockResolvedValue({
      id: 1,
      username: 'mdupont',
      name: 'Marie Dupont',
      avatar_url: null,
      web_url: '',
    });
    gitlab.getTokenInfo.mockResolvedValue({
      scopes: ['read_api'],
      expires_at: '2027-03-12',
    });
  });

  const api = () => request(app.getHttpServer());

  it('GET /settings should_return_defaults_after_migration', async () => {
    const res = await api().get('/api/v1/settings');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      gitlabUrl: 'https://gitlab.com',
      tokenConfigured: false,
      tokenHint: null,
      meUsername: null,
      meEmail: null,
      refreshIntervalMin: 5,
      pauseWhenHidden: true,
    });
  });

  it('POST /settings/test-connection should_be_409_without_any_token', async () => {
    const res = await api()
      .post('/api/v1/settings/test-connection')
      .send({ gitlabUrl: 'https://gitlab.com' });

    expect(res.status).toBe(409);
    expect(body(res).code).toBe('settings.tokenMissing');
  });

  it('PUT /settings should_reject_url_without_scheme', async () => {
    const res = await api()
      .put('/api/v1/settings')
      .send({ gitlabUrl: 'gitlab.exemple.fr' });

    expect(res.status).toBe(400);
    expect(body(res).message).toEqual([expect.stringContaining('gitlabUrl')]);
  });

  it('PUT /settings should_reject_short_token', async () => {
    const res = await api()
      .put('/api/v1/settings')
      .send({ gitlabUrl: 'https://gitlab.com', gitlabToken: 'abc' });

    expect(res.status).toBe(400);
    expect(body(res).message).toEqual([expect.stringContaining('gitlabToken')]);
  });

  it('PUT /settings should_reject_unknown_fields', async () => {
    const res = await api()
      .put('/api/v1/settings')
      .send({ gitlabUrl: 'https://gitlab.com', hack: true });

    expect(res.status).toBe(400);
  });

  it('PUT /settings should_store_normalized_url_and_masked_token', async () => {
    const res = await api()
      .put('/api/v1/settings')
      .send({ gitlabUrl: 'https://gitlab.exemple.fr/', gitlabToken: TOKEN });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      gitlabUrl: 'https://gitlab.exemple.fr',
      tokenConfigured: true,
      tokenHint: 'wxyz',
      meUsername: null,
      meEmail: null,
      refreshIntervalMin: 5,
      pauseWhenHidden: true,
    });
    expect(JSON.stringify(res.body)).not.toContain('e2e-secret');

    const get = await api().get('/api/v1/settings');
    expect(get.body).toEqual(res.body);
  });

  it('PUT /settings should_keep_token_when_field_is_empty_or_absent', async () => {
    const empty = await api()
      .put('/api/v1/settings')
      .send({ gitlabUrl: 'https://gitlab.exemple.fr', gitlabToken: '' });
    expect(empty.status).toBe(200);
    expect(body(empty).tokenConfigured).toBe(true);

    const absent = await api()
      .put('/api/v1/settings')
      .send({ gitlabUrl: 'https://other.exemple.fr' });
    expect(absent.body).toEqual({
      gitlabUrl: 'https://other.exemple.fr',
      tokenConfigured: true,
      tokenHint: 'wxyz',
      meUsername: null,
      meEmail: null,
      refreshIntervalMin: 5,
      pauseWhenHidden: true,
    });
  });

  it('POST /settings/test-connection should_use_stored_token_when_omitted', async () => {
    const res = await api()
      .post('/api/v1/settings/test-connection')
      .send({ gitlabUrl: 'https://other.exemple.fr' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      username: 'mdupont',
      name: 'Marie Dupont',
      avatarUrl: null,
      expiresAt: '2027-03-12',
      expirationKnown: true,
    });
    expect(gitlab.getCurrentUser).toHaveBeenCalledWith(
      'https://other.exemple.fr',
      TOKEN,
    );
  });

  it('POST /settings/test-connection should_use_body_token_when_given', async () => {
    await api().post('/api/v1/settings/test-connection').send({
      gitlabUrl: 'https://gitlab.com/',
      gitlabToken: 'glpat-another-token',
    });

    expect(gitlab.getCurrentUser).toHaveBeenCalledWith(
      'https://gitlab.com',
      'glpat-another-token',
    );
  });

  it('POST /settings/test-connection should_map_auth_failure_to_502', async () => {
    gitlab.getCurrentUser.mockRejectedValue(new GitlabAuthException());

    const res = await api().post('/api/v1/settings/test-connection').send({
      gitlabUrl: 'https://gitlab.com',
      gitlabToken: 'glpat-another-token',
    });

    expect(res.status).toBe(502);
    expect(body(res).code).toBe('gitlab.auth');
  });

  it('POST /settings/test-connection should_map_unavailable_to_502', async () => {
    gitlab.getCurrentUser.mockRejectedValue(new GitlabUnavailableException());

    const res = await api().post('/api/v1/settings/test-connection').send({
      gitlabUrl: 'https://gitlab.com',
      gitlabToken: 'glpat-another-token',
    });

    expect(res.status).toBe(502);
    expect(body(res).code).toBe('gitlab.unavailable');
  });

  it('POST /settings/test-connection should_be_400_on_insufficient_scope', async () => {
    gitlab.getTokenInfo.mockResolvedValue({
      scopes: ['read_user'],
      expires_at: null,
    });

    const res = await api().post('/api/v1/settings/test-connection').send({
      gitlabUrl: 'https://gitlab.com',
      gitlabToken: 'glpat-another-token',
    });

    expect(res.status).toBe(400);
    expect(body(res).code).toBe('gitlab.scope');
  });

  it('POST /settings/test-connection should_tolerate_missing_token_info', async () => {
    gitlab.getTokenInfo.mockResolvedValue(null);

    const res = await api().post('/api/v1/settings/test-connection').send({
      gitlabUrl: 'https://gitlab.com',
      gitlabToken: 'glpat-another-token',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ expirationKnown: false, expiresAt: null }),
    );
  });

  it('PUT /settings should_set_identity_fields_trimmed', async () => {
    const res = await api().put('/api/v1/settings').send({
      gitlabUrl: 'https://gitlab.com',
      meUsername: '  mdupont  ',
      meEmail: '  marie@exemple.fr  ',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        meUsername: 'mdupont',
        meEmail: 'marie@exemple.fr',
      }),
    );
  });

  it('PUT /settings should_keep_identity_fields_when_omitted', async () => {
    const res = await api()
      .put('/api/v1/settings')
      .send({ gitlabUrl: 'https://gitlab.com' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        meUsername: 'mdupont',
        meEmail: 'marie@exemple.fr',
      }),
    );
  });

  it('PUT /settings should_reject_invalid_email', async () => {
    const res = await api()
      .put('/api/v1/settings')
      .send({ gitlabUrl: 'https://gitlab.com', meEmail: 'marie@' });

    expect(res.status).toBe(400);
    expect(body(res).message).toEqual([expect.stringContaining('meEmail')]);
  });

  it('PUT /settings should_clear_identity_fields_with_empty_strings', async () => {
    const res = await api().put('/api/v1/settings').send({
      gitlabUrl: 'https://gitlab.com',
      meUsername: '',
      meEmail: '',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ meUsername: null, meEmail: null }),
    );
  });

  it('POST /settings/test-connection should_reject_identity_fields_in_body', async () => {
    const res = await api().post('/api/v1/settings/test-connection').send({
      gitlabUrl: 'https://gitlab.com',
      meUsername: 'mdupont',
    });

    expect(res.status).toBe(400);
  });

  it('PUT /settings should_store_refresh_settings', async () => {
    const res = await api().put('/api/v1/settings').send({
      gitlabUrl: 'https://gitlab.com',
      refreshIntervalMin: 15,
      pauseWhenHidden: false,
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        refreshIntervalMin: 15,
        pauseWhenHidden: false,
      }),
    );

    const get = await api().get('/api/v1/settings');
    expect(get.body).toEqual(
      expect.objectContaining({
        refreshIntervalMin: 15,
        pauseWhenHidden: false,
      }),
    );
  });

  it('PUT /settings should_keep_refresh_settings_when_omitted', async () => {
    const res = await api()
      .put('/api/v1/settings')
      .send({ gitlabUrl: 'https://gitlab.com' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        refreshIntervalMin: 15,
        pauseWhenHidden: false,
      }),
    );
  });

  it('PUT /settings should_reject_an_out_of_enum_refresh_interval', async () => {
    const res = await api().put('/api/v1/settings').send({
      gitlabUrl: 'https://gitlab.com',
      refreshIntervalMin: 7,
    });

    expect(res.status).toBe(400);
    expect(body(res).message).toEqual([
      expect.stringContaining('refreshIntervalMin'),
    ]);
  });
});
