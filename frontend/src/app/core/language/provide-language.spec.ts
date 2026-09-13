import { EnvironmentInjector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Settings } from '../../models/settings.model';
import { SettingsStore } from '../../stores/settings.store';
import { TranslateService } from '../i18n/translate.service';
import { provideLanguage } from './provide-language';

describe('provideLanguage', () => {
  it('should_instantiate_language_service_eagerly_without_it_being_injected_directly', () => {
    const settingsStore = { settings: signal<Settings | null>(null), save: vi.fn() };
    const translateService = { load: vi.fn().mockResolvedValue(undefined) };

    TestBed.configureTestingModule({
      providers: [
        provideLanguage(),
        { provide: SettingsStore, useValue: settingsStore },
        { provide: TranslateService, useValue: translateService },
      ],
    });
    // Force la création de l'injecteur d'environnement, qui exécute les
    // `ENVIRONMENT_INITIALIZER` — sans jamais injecter `LanguageService` ici.
    TestBed.inject(EnvironmentInjector);
    TestBed.flushEffects();

    expect(translateService.load).toHaveBeenCalledWith('fr');
  });
});
