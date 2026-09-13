import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError, errorKeyOf } from '../core/api/api-error';
import { SettingsService } from '../core/api/settings.service';
import { Settings } from '../models/settings.model';
import { SettingsStore } from './settings.store';

describe('SettingsStore', () => {
  const settings: Settings = {
    gitlabUrl: 'https://gitlab.com',
    tokenConfigured: false,
    tokenHint: null,
    meUsername: null,
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
  };
  const api = {
    getSettings: vi.fn(),
    putSettings: vi.fn(),
    postTestConnection: vi.fn(),
    getExportConfig: vi.fn(),
    postImportConfig: vi.fn(),
  };
  let store: InstanceType<typeof SettingsStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [{ provide: SettingsService, useValue: api }] });
    store = TestBed.inject(SettingsStore);
  });

  it('should_load_settings', async () => {
    api.getSettings.mockReturnValue(of(settings));

    const pending = store.load();
    expect(store.loading()).toBe(true);
    await pending;

    expect(store.loading()).toBe(false);
    expect(store.settings()).toEqual(settings);
    expect(store.loadError()).toBeNull();
  });

  it('should_expose_load_error_key', async () => {
    api.getSettings.mockReturnValue(throwError(() => new ApiError(0, undefined, 'down')));

    await store.load();

    expect(store.loading()).toBe(false);
    expect(store.loadError()).toBe('errors.network');
  });

  it('should_save_and_update_settings', async () => {
    const saved = { ...settings, tokenConfigured: true, tokenHint: 'wxyz' };
    api.putSettings.mockReturnValue(of(saved));

    const error = await store.save({ gitlabUrl: 'https://gitlab.com', gitlabToken: 'glpat-abcdwxyz' });

    expect(error).toBeNull();
    expect(store.saving()).toBe(false);
    expect(store.settings()).toEqual(saved);
  });

  it('should_return_error_key_when_save_fails', async () => {
    api.putSettings.mockReturnValue(
      throwError(() => new ApiError(400, 'settings.invalidUrl', 'bad')),
    );

    const error = await store.save({ gitlabUrl: 'nope' });

    expect(error).toBe('errors.settings.invalidUrl');
    expect(store.saving()).toBe(false);
  });

  it('should_test_connection_with_success', async () => {
    const result = {
      username: 'mdupont',
      name: 'Marie Dupont',
      avatarUrl: null,
      expiresAt: '2027-03-12',
      expirationKnown: true,
    };
    api.postTestConnection.mockReturnValue(of(result));

    const pending = store.testConnection({ gitlabUrl: 'https://gitlab.com' });
    expect(store.test().status).toBe('pending');
    await pending;

    expect(store.test()).toEqual({ status: 'success', result, errorKey: null });
  });

  it('should_test_connection_with_error_key', async () => {
    api.postTestConnection.mockReturnValue(
      throwError(() => new ApiError(502, 'gitlab.auth', 'rejected')),
    );

    await store.testConnection({ gitlabUrl: 'https://gitlab.com' });

    expect(store.test()).toEqual({ status: 'error', result: null, errorKey: 'errors.gitlab.auth' });
  });

  it('should_reset_test', async () => {
    api.postTestConnection.mockReturnValue(throwError(() => new Error('x')));
    await store.testConnection({ gitlabUrl: 'https://gitlab.com' });
    expect(store.test().status).toBe('error');

    store.resetTest();

    expect(store.test().status).toBe('idle');
  });

  it('should_export_config', async () => {
    const config = { version: 1 as const, settings: { gitlabUrl: 'https://gitlab.com' }, projects: [] };
    api.getExportConfig.mockReturnValue(of(config));

    const { data, errorKey } = await store.exportConfig();

    expect(data).toEqual(config);
    expect(errorKey).toBeNull();
  });

  it('should_return_error_key_when_export_fails', async () => {
    api.getExportConfig.mockReturnValue(throwError(() => new ApiError(0, undefined, 'down')));

    const { data, errorKey } = await store.exportConfig();

    expect(data).toBeNull();
    expect(errorKey).toBe('errors.network');
  });

  it('should_import_config_and_update_settings', async () => {
    const result = {
      settings: { ...settings, easyFiles: 10 },
      projectsAdded: 1,
      projectsUpdated: 0,
      projectsSkipped: [],
    };
    api.postImportConfig.mockReturnValue(of(result));

    const { result: resolved, errorKey } = await store.importConfig({
      version: 1,
      settings: { gitlabUrl: 'https://gitlab.com' },
      projects: [],
    });

    expect(resolved).toEqual(result);
    expect(errorKey).toBeNull();
    expect(store.settings()).toEqual(result.settings);
  });

  it('should_return_error_key_when_import_fails', async () => {
    api.postImportConfig.mockReturnValue(
      throwError(() => new ApiError(400, 'settings.importInvalid', 'bad')),
    );

    const { result, errorKey } = await store.importConfig({
      version: 1,
      settings: { gitlabUrl: 'https://gitlab.com' },
      projects: [],
    });

    expect(result).toBeNull();
    expect(errorKey).toBe('errors.settings.importInvalid');
  });

  it('should_map_unknown_errors_to_unexpected', () => {
    expect(errorKeyOf(new Error('boom'))).toBe('errors.unexpected');
    expect(errorKeyOf(new ApiError(404, 'entity.notFound', 'x'))).toBe('errors.entity.notFound');
  });
});
