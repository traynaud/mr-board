import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { SettingsStore } from '../../stores/settings.store';
import { ThemePreference, UpdateSettingsRequest } from '../../models/settings.model';
import { EffectiveTheme } from './theme.model';
import { readStoredTheme, writeStoredTheme } from './theme-storage';

/** Attribut posé sur `<html>`, identique au script anti-flash de `index.html`. */
const DATA_THEME_ATTRIBUTE = 'data-theme';

/**
 * Thème effectif de l'application (RG-018-01 à 13). Source de vérité unique
 * pour `data-theme` sur `<html>` : aucun composant ne doit manipuler cet
 * attribut ou `matchMedia` directement (RG-018-06).
 *
 * Dépend de `SettingsStore` (dérogation à la séparation habituelle
 * `core/`/`stores/`) pour recopier `settings.theme` dans `localStorage` et
 * l'exposer à toute l'application dès son chargement, quelle que soit la
 * page qui a déclenché ce chargement (RG-018-05).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly settingsStore = inject(SettingsStore);

  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');
  private readonly systemPrefersDark = signal(this.media.matches);

  /** Dernière préférence connue comme enregistrée côté backend (ou le cache anti-flash avant le premier chargement). */
  private readonly persisted = signal<ThemePreference>(readStoredTheme() ?? 'system');

  /** Aperçu en cours d'édition dans Paramètres (RG-018-03) ; `null` = aucun aperçu actif. */
  private readonly preview = signal<ThemePreference | null>(null);

  /** Préférence à appliquer : l'aperçu prime sur la valeur enregistrée. */
  readonly preference = computed<ThemePreference>(() => this.preview() ?? this.persisted());

  /** Thème réellement rendu, `system` résolu contre l'OS (RG-018-04). */
  readonly effective = computed<EffectiveTheme>(() => {
    const preference = this.preference();
    return preference === 'system' ? (this.systemPrefersDark() ? 'dark' : 'light') : preference;
  });

  constructor() {
    this.media.addEventListener('change', (event) => this.systemPrefersDark.set(event.matches));

    // RG-018-05 : recopie la valeur enregistrée dans localStorage à chaque
    // chargement des paramètres, quelle que soit la page à l'origine du load.
    effect(() => {
      const settings = this.settingsStore.settings();
      if (settings) {
        this.persisted.set(settings.theme);
        writeStoredTheme(settings.theme);
      }
    });

    // RG-018-05/07 : pose ou retire `data-theme` sur <html> selon la
    // préférence (pas le thème résolu) — absent pour `system` laisse le
    // navigateur trancher seul via `@media (prefers-color-scheme: dark)`.
    effect(() => {
      const preference = this.preference();
      if (preference === 'system') {
        document.documentElement.removeAttribute(DATA_THEME_ATTRIBUTE);
      } else {
        document.documentElement.setAttribute(DATA_THEME_ATTRIBUTE, preference);
      }
    });
  }

  /** Aperçu immédiat pendant l'édition de la section Divers (RG-018-03). */
  setPreview(theme: ThemePreference): void {
    this.preview.set(theme);
  }

  /** Restaure le thème enregistré (RG-018-03) : Annuler ou abandon des modifications (RG-001-07). */
  clearPreview(): void {
    this.preview.set(null);
  }

  /**
   * Bascule rapide clair/sombre depuis la toolbar (RG-018-12/13) : sort du
   * mode `system` le cas échéant, applique immédiatement en local puis
   * enregistre en tâche de fond via le `PUT /settings` existant (seul
   * `theme` est fourni : les autres réglages restent inchangés).
   * @returns la clé i18n de l'erreur, ou `null` en cas de succès.
   */
  async quickToggle(): Promise<string | null> {
    const settings = this.settingsStore.settings();
    if (!settings) {
      // Paramètres pas encore chargés : rien à appliquer, pour éviter un
      // aperçu optimiste qu'un `GET /settings` en cours écraserait ensuite
      // silencieusement dès qu'il résout.
      return null;
    }
    const next: EffectiveTheme = this.effective() === 'dark' ? 'light' : 'dark';
    this.persisted.set(next);
    writeStoredTheme(next);
    const request: UpdateSettingsRequest = { theme: next };
    return this.settingsStore.save(request);
  }
}
