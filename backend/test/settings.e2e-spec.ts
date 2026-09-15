import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app.js';

interface Body {
  code?: string;
  message?: string[];
  meEmail?: string | null;
  refreshIntervalMin?: number;
  pauseWhenHidden?: boolean;
}
const body = (res: request.Response): Body => res.body as Body;

describe('Settings (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  it('GET /settings should_return_defaults_after_migration', async () => {
    const res = await api().get('/api/v1/settings');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      meEmail: null,
      refreshIntervalMin: 5,
      pauseWhenHidden: true,
      easyFiles: 5,
      easyLines: 100,
      hardFiles: 20,
      hardLines: 800,
      readyGreenDays: 1,
      readyOrangeDays: 3,
      workdaysOnly: false,
      openInNewTab: false,
      ignoredLabels: [],
      notifyAssigned: false,
      tabBadge: false,
      theme: 'system',
      highlightMe: true,
      language: 'fr',
    });
  });

  it('PUT /settings should_reject_unknown_fields', async () => {
    const res = await api()
      .put('/api/v1/settings')
      .send({ meEmail: 'marie@exemple.fr', hack: true });

    expect(res.status).toBe(400);
  });

  it('PUT /settings should_set_identity_fields_trimmed', async () => {
    const res = await api().put('/api/v1/settings').send({
      meEmail: '  marie@exemple.fr  ',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ meEmail: 'marie@exemple.fr' }),
    );
  });

  it('PUT /settings should_keep_identity_fields_when_omitted', async () => {
    const res = await api().put('/api/v1/settings').send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ meEmail: 'marie@exemple.fr' }),
    );
  });

  it('PUT /settings should_reject_invalid_email', async () => {
    const res = await api().put('/api/v1/settings').send({ meEmail: 'marie@' });

    expect(res.status).toBe(400);
    expect(body(res).message).toEqual([expect.stringContaining('meEmail')]);
  });

  it('PUT /settings should_clear_identity_fields_with_empty_strings', async () => {
    const res = await api().put('/api/v1/settings').send({ meEmail: '' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ meEmail: null }));
  });

  it('PUT /settings should_apply_a_per_connection_identity', async () => {
    const connection = await api().post('/api/v1/connections').send({
      type: 'gitlab',
      name: 'gitlab.exemple.fr',
      url: 'https://gitlab.exemple.fr',
      token: 'glpat-settings-e2e-token',
    });

    const res = await api()
      .put('/api/v1/settings')
      .send({
        identities: [
          {
            connectionId: (connection.body as { id: number }).id,
            username: 'mdupont',
          },
        ],
      });

    expect(res.status).toBe(200);
    const list = await api().get('/api/v1/connections');
    expect(list.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ meUsername: 'mdupont' }),
      ]),
    );
  });

  it('PUT /settings should_store_refresh_settings', async () => {
    const res = await api().put('/api/v1/settings').send({
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
    const res = await api().put('/api/v1/settings').send({});

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
      refreshIntervalMin: 7,
    });

    expect(res.status).toBe(400);
    expect(body(res).message).toEqual([
      expect.stringContaining('refreshIntervalMin'),
    ]);
  });

  it('PUT /settings should_reject_a_non_boolean_value_for_a_boolean_field', async () => {
    const res = await api().put('/api/v1/settings').send({
      pauseWhenHidden: 'yes',
    });

    expect(res.status).toBe(400);
    expect(body(res).message).toEqual([
      expect.stringContaining('pauseWhenHidden'),
    ]);

    const get = await api().get('/api/v1/settings');
    expect(get.body).toEqual(
      expect.objectContaining({ pauseWhenHidden: false }),
    );
  });

  it('PUT /settings should_store_valid_thresholds', async () => {
    const res = await api().put('/api/v1/settings').send({
      easyFiles: 10,
      easyLines: 200,
      hardFiles: 30,
      hardLines: 900,
      readyGreenDays: 2,
      readyOrangeDays: 5,
      workdaysOnly: true,
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        easyFiles: 10,
        easyLines: 200,
        hardFiles: 30,
        hardLines: 900,
        readyGreenDays: 2,
        readyOrangeDays: 5,
        workdaysOnly: true,
      }),
    );

    const get = await api().get('/api/v1/settings');
    expect(get.body).toEqual(res.body);
  });

  it('PUT /settings should_reject_hard_files_not_greater_than_easy_files', async () => {
    const res = await api().put('/api/v1/settings').send({
      easyFiles: 10,
      hardFiles: 10,
    });

    expect(res.status).toBe(400);
    expect(body(res).code).toBe('settings.hardFilesTooLow');
  });

  it('PUT /settings should_reject_hard_lines_not_greater_than_easy_lines', async () => {
    const res = await api().put('/api/v1/settings').send({
      easyLines: 100,
      hardLines: 80,
    });

    expect(res.status).toBe(400);
    expect(body(res).code).toBe('settings.hardLinesTooLow');
  });

  it('PUT /settings should_reject_ready_orange_not_greater_than_ready_green', async () => {
    const res = await api().put('/api/v1/settings').send({
      readyGreenDays: 4,
      readyOrangeDays: 4,
    });

    expect(res.status).toBe(400);
    expect(body(res).code).toBe('settings.readyOrangeTooLow');
  });

  it('PUT /settings should_reject_a_non_integer_threshold', async () => {
    const res = await api().put('/api/v1/settings').send({ easyLines: 2.5 });

    expect(res.status).toBe(400);
    expect(body(res).message).toEqual([expect.stringContaining('easyLines')]);
  });

  it('PUT /settings should_store_the_new_tab_and_ignored_labels_options', async () => {
    const res = await api()
      .put('/api/v1/settings')
      .send({
        openInNewTab: true,
        ignoredLabels: ['wip', 'on-hold'],
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        openInNewTab: true,
        ignoredLabels: ['wip', 'on-hold'],
      }),
    );

    const get = await api().get('/api/v1/settings');
    expect(get.body).toEqual(res.body);
  });

  it('PUT /settings should_keep_the_new_tab_and_ignored_labels_options_when_omitted', async () => {
    const res = await api().put('/api/v1/settings').send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        openInNewTab: true,
        ignoredLabels: ['wip', 'on-hold'],
      }),
    );
  });

  it('PUT /settings should_store_the_notification_settings', async () => {
    const res = await api().put('/api/v1/settings').send({
      notifyAssigned: true,
      tabBadge: true,
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ notifyAssigned: true, tabBadge: true }),
    );

    const get = await api().get('/api/v1/settings');
    expect(get.body).toEqual(res.body);
  });

  it('PUT /settings should_keep_the_notification_settings_when_omitted', async () => {
    const res = await api().put('/api/v1/settings').send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ notifyAssigned: true, tabBadge: true }),
    );
  });

  it('PUT /settings should_store_the_theme', async () => {
    const res = await api().put('/api/v1/settings').send({ theme: 'dark' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ theme: 'dark' }));

    const get = await api().get('/api/v1/settings');
    expect(get.body).toEqual(res.body);
  });

  it('PUT /settings should_keep_the_theme_when_omitted', async () => {
    const res = await api().put('/api/v1/settings').send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ theme: 'dark' }));
  });

  it('PUT /settings should_reject_an_invalid_theme', async () => {
    const res = await api().put('/api/v1/settings').send({ theme: 'blue' });

    expect(res.status).toBe(400);
    expect(body(res).message).toEqual([expect.stringContaining('theme')]);
  });

  it('PUT /settings should_store_highlight_me', async () => {
    const res = await api()
      .put('/api/v1/settings')
      .send({ highlightMe: false });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ highlightMe: false }));

    const get = await api().get('/api/v1/settings');
    expect(get.body).toEqual(res.body);
  });

  it('PUT /settings should_keep_highlight_me_when_omitted', async () => {
    const res = await api().put('/api/v1/settings').send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ highlightMe: false }));
  });

  it('PUT /settings should_store_the_language', async () => {
    const res = await api().put('/api/v1/settings').send({ language: 'en' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ language: 'en' }));

    const get = await api().get('/api/v1/settings');
    expect(get.body).toEqual(res.body);
  });

  it('PUT /settings should_keep_the_language_when_omitted', async () => {
    const res = await api().put('/api/v1/settings').send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ language: 'en' }));
  });

  it('PUT /settings should_reject_an_invalid_language', async () => {
    const res = await api().put('/api/v1/settings').send({ language: 'de' });

    expect(res.status).toBe(400);
    expect(body(res).message).toEqual([expect.stringContaining('language')]);
  });

  it('PUT /settings should_reject_a_non_array_ignored_labels', async () => {
    const res = await api()
      .put('/api/v1/settings')
      .send({ ignoredLabels: 'wip' });

    expect(res.status).toBe(400);
    expect(body(res).message).toEqual([
      expect.stringContaining('ignoredLabels'),
    ]);
  });
});
