import { EnvironmentProviders, inject, provideEnvironmentInitializer } from '@angular/core';
import { LanguageService } from './language.service';

/**
 * Force l'instanciation précoce de `LanguageService` au démarrage de
 * l'application, pour que son effet de synchronisation avec `SettingsStore`
 * soit actif dès le premier rendu, indépendamment de la page visitée.
 * À déclarer dans `app.config.ts`.
 */
export function provideLanguage(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => inject(LanguageService));
}
