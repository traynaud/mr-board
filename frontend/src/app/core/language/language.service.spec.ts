import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Settings } from '../../models/settings.model';
import { SettingsStore } from '../../stores/settings.store';
import { TranslateService } from '../i18n/translate.service';
import { LANGUAGE_STORAGE_KEY, writeStoredLanguage } from './language-storage';
import { LanguageService } from './language.service';

function settings(overrides: Partial<Settings> = {}): Settings {
  return {
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
    ...overrides,
  };
}

describe('LanguageService', () => {
  const settingsSignal = signal<Settings | null>(null);
  const settingsStore = { settings: settingsSignal, save: vi.fn() };
  const translateService = { load: vi.fn().mockResolvedValue(undefined) };

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    settingsSignal.set(null);
  });

  /** Les `effect()` du service ne s'exécutent pas de façon synchrone. */
  const flush = (): void => TestBed.flushEffects();

  const create = (): LanguageService => {
    TestBed.configureTestingModule({
      providers: [
        { provide: SettingsStore, useValue: settingsStore },
        { provide: TranslateService, useValue: translateService },
      ],
    });
    const service = TestBed.inject(LanguageService);
    flush();
    return service;
  };

  it('should_default_to_french_when_nothing_is_stored', () => {
    const service = create();

    expect(service.preference()).toBe('fr');
    expect(translateService.load).toHaveBeenCalledWith('fr');
  });

  it('should_read_the_cached_language_before_settings_load', () => {
    writeStoredLanguage('en');

    const service = create();

    expect(service.preference()).toBe('en');
    expect(translateService.load).toHaveBeenCalledWith('en');
  });

  it('should_sync_from_settings_store_and_write_local_storage_on_every_load', () => {
    const service = create();

    settingsSignal.set(settings({ language: 'en' }));
    flush();

    expect(service.preference()).toBe('en');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(translateService.load).toHaveBeenCalledWith('en');
  });

  it('should_let_backend_settings_win_over_a_stale_local_cache', () => {
    writeStoredLanguage('en');
    const service = create();

    settingsSignal.set(settings({ language: 'fr' }));
    flush();

    expect(service.preference()).toBe('fr');
  });

  describe('preview', () => {
    it('should_override_the_persisted_language_until_cleared', () => {
      const service = create();
      settingsSignal.set(settings({ language: 'fr' }));
      flush();

      service.setPreview('en');
      flush();

      expect(service.preference()).toBe('en');
      expect(translateService.load).toHaveBeenCalledWith('en');

      service.clearPreview();
      flush();

      expect(service.preference()).toBe('fr');
      expect(translateService.load).toHaveBeenCalledWith('fr');
    });
  });
});
