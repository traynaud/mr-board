import { EnvironmentProviders, inject, provideAppInitializer } from '@angular/core';
import { readStoredLanguage } from '../language/language-storage';
import { TranslateService } from './translate.service';

/**
 * Charge le dictionnaire de traduction avant le premier rendu, dans la
 * langue mise en cache (`localStorage`, RG-022-04) ou `fr` par défaut. La
 * valeur backend fait autorité dès sa réception (`LanguageService`).
 * À déclarer dans `app.config.ts`.
 */
export function provideI18n(): EnvironmentProviders {
  return provideAppInitializer(() =>
    inject(TranslateService).load(readStoredLanguage() ?? 'fr'),
  );
}
