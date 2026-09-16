import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Settings } from '../../models/settings.model';
import { SettingsStore } from '../../stores/settings.store';
import { THEME_STORAGE_KEY, writeStoredTheme } from './theme-storage';
import { stubMatchMedia } from './testing';
import { ThemeService } from './theme.service';

function settings(overrides: Partial<Settings> = {}): Settings {
  return {
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

describe('ThemeService', () => {
  const settingsSignal = signal<Settings | null>(null);
  const save = vi.fn();
  const settingsStore = { settings: settingsSignal, save };

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    vi.clearAllMocks();
    settingsSignal.set(null);
  });

  /** Les `effect()` du service ne s'exécutent pas de façon synchrone. */
  const flush = (): void => TestBed.flushEffects();

  const create = (): ThemeService => {
    TestBed.configureTestingModule({
      providers: [{ provide: SettingsStore, useValue: settingsStore }],
    });
    const service = TestBed.inject(ThemeService);
    flush();
    return service;
  };

  it('should_default_to_system_when_nothing_is_stored', () => {
    stubMatchMedia(false);

    const service = create();

    expect(service.preference()).toBe('system');
    expect(service.effective()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('should_read_the_cached_preference_before_settings_load', () => {
    writeStoredTheme('dark');
    stubMatchMedia(false);

    const service = create();

    expect(service.preference()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('should_resolve_system_against_the_os_preference', () => {
    stubMatchMedia(true);

    const service = create();

    expect(service.effective()).toBe('dark');
  });

  it('should_track_a_live_os_preference_change', () => {
    const media = stubMatchMedia(false);

    const service = create();
    expect(service.effective()).toBe('light');

    media.matches = true;
    media.listeners.forEach((listener) => listener({ matches: true }));

    expect(service.effective()).toBe('dark');
  });

  it('should_sync_from_settings_store_and_write_local_storage_on_every_load', () => {
    stubMatchMedia(false);
    const service = create();

    settingsSignal.set(settings({ theme: 'dark' }));
    flush();

    expect(service.preference()).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('should_let_backend_settings_win_over_a_stale_local_cache', () => {
    writeStoredTheme('dark');
    stubMatchMedia(false);
    const service = create();

    settingsSignal.set(settings({ theme: 'light' }));
    flush();

    expect(service.preference()).toBe('light');
  });

  describe('preview', () => {
    it('should_override_the_persisted_preference_until_cleared', () => {
      stubMatchMedia(false);
      const service = create();
      settingsSignal.set(settings({ theme: 'light' }));
      flush();

      service.setPreview('dark');
      flush();

      expect(service.preference()).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

      service.clearPreview();
      flush();

      expect(service.preference()).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
  });

  describe('quickToggle', () => {
    it('should_apply_the_opposite_theme_immediately_and_save_it', async () => {
      stubMatchMedia(false);
      const service = create();
      settingsSignal.set(settings({ theme: 'light' }));
      flush();
      save.mockResolvedValue(null);

      const errorKey = await service.quickToggle();

      expect(service.preference()).toBe('dark');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
      expect(save).toHaveBeenCalledWith({ theme: 'dark' });
      expect(errorKey).toBeNull();
    });

    it('should_leave_system_for_the_resolved_opposite_theme', async () => {
      stubMatchMedia(true);
      const service = create();
      settingsSignal.set(settings({ theme: 'system' }));
      flush();
      save.mockResolvedValue(null);

      await service.quickToggle();

      expect(service.preference()).toBe('light');
    });

    it('should_keep_the_optimistic_theme_and_report_the_error_key_on_failure', async () => {
      stubMatchMedia(false);
      const service = create();
      settingsSignal.set(settings({ theme: 'light' }));
      flush();
      save.mockResolvedValue('errors.unexpected');

      const errorKey = await service.quickToggle();

      expect(errorKey).toBe('errors.unexpected');
      expect(service.preference()).toBe('dark');
    });

    it('should_do_nothing_when_settings_are_not_loaded_yet', async () => {
      stubMatchMedia(false);
      const service = create();

      const errorKey = await service.quickToggle();

      expect(errorKey).toBeNull();
      expect(save).not.toHaveBeenCalled();
    });
  });
});
