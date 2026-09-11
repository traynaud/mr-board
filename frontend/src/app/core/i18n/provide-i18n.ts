import { EnvironmentProviders, inject, provideAppInitializer } from '@angular/core';
import { TranslateService } from './translate.service';

/**
 * Charge le dictionnaire de traduction avant le premier rendu.
 * À déclarer dans `app.config.ts`.
 */
export function provideI18n(): EnvironmentProviders {
  return provideAppInitializer(() => inject(TranslateService).load());
}
