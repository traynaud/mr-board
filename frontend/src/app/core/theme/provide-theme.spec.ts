import { EnvironmentInjector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Settings } from '../../models/settings.model';
import { SettingsStore } from '../../stores/settings.store';
import { writeStoredTheme } from './theme-storage';
import { stubMatchMedia } from './testing';
import { provideTheme } from './provide-theme';

describe('provideTheme', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute('data-theme');
  });

  it('should_instantiate_theme_service_eagerly_without_it_being_injected_directly', () => {
    writeStoredTheme('dark');
    stubMatchMedia(false);
    const settingsStore = { settings: signal<Settings | null>(null), save: vi.fn() };

    TestBed.configureTestingModule({
      providers: [provideTheme(), { provide: SettingsStore, useValue: settingsStore }],
    });
    // Force la création de l'injecteur d'environnement, qui exécute les
    // `ENVIRONMENT_INITIALIZER` — sans jamais injecter `ThemeService` ici.
    TestBed.inject(EnvironmentInjector);
    TestBed.flushEffects();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
