import { EnvironmentProviders, inject, provideEnvironmentInitializer } from '@angular/core';
import { ThemeService } from './theme.service';

/**
 * Force l'instanciation précoce de `ThemeService` au démarrage de
 * l'application, pour que ses écouteurs (`matchMedia`, `SettingsStore`)
 * soient actifs dès le premier rendu, indépendamment de la page visitée.
 * À déclarer dans `app.config.ts`.
 */
export function provideTheme(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => inject(ThemeService));
}
