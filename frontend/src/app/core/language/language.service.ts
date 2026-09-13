import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { SettingsStore } from '../../stores/settings.store';
import { Language } from '../../models/settings.model';
import { TranslateService } from '../i18n/translate.service';
import { readStoredLanguage, writeStoredLanguage } from './language-storage';

/**
 * Langue effective de l'application (RG-022-01 à 13). Source de vérité
 * unique pour le chargement du dictionnaire actif : aucun composant ne doit
 * appeler `TranslateService.load()` directement.
 *
 * Dépend de `SettingsStore` (même dérogation que `ThemeService`, US-018) pour
 * recopier `settings.language` dans `localStorage` et déclencher le
 * chargement du bon dictionnaire dès son chargement, quelle que soit la page
 * qui a déclenché ce chargement (RG-022-04).
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly settingsStore = inject(SettingsStore);
  private readonly translateService = inject(TranslateService);

  /** Dernière langue connue comme enregistrée côté backend (ou le cache anti-flash avant le premier chargement). */
  private readonly persisted = signal<Language>(readStoredLanguage() ?? 'fr');

  /** Aperçu en cours d'édition dans Paramètres (RG-022-03) ; `null` = aucun aperçu actif. */
  private readonly preview = signal<Language | null>(null);

  /** Langue à appliquer : l'aperçu prime sur la valeur enregistrée. */
  readonly preference = computed<Language>(() => this.preview() ?? this.persisted());

  constructor() {
    // RG-022-04 : recopie la valeur enregistrée dans localStorage à chaque
    // chargement des paramètres, quelle que soit la page à l'origine du load.
    effect(() => {
      const settings = this.settingsStore.settings();
      if (settings) {
        this.persisted.set(settings.language);
        writeStoredLanguage(settings.language);
      }
    });

    // RG-022-03/04 : charge (ou active, si déjà en cache) le dictionnaire de
    // la langue courante à chaque changement de préférence ou d'aperçu.
    effect(() => {
      void this.translateService.load(this.preference());
    });
  }

  /** Aperçu immédiat pendant l'édition de la section Divers (RG-022-03). */
  setPreview(language: Language): void {
    this.preview.set(language);
  }

  /** Restaure la langue enregistrée (RG-022-03) : Annuler ou abandon des modifications (RG-001-07). */
  clearPreview(): void {
    this.preview.set(null);
  }
}
