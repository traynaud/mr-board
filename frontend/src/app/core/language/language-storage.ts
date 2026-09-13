import { Language } from '../../models/settings.model';

/**
 * RG-022-04 : clé `localStorage` utilisée comme cache anti-flash, sur le
 * modèle de `THEME_STORAGE_KEY` (`core/theme/theme-storage.ts`).
 */
export const LANGUAGE_STORAGE_KEY = 'mrboard.language.v1';

/**
 * Lit la langue mise en cache, tolérante à un `localStorage` indisponible ou
 * à une valeur corrompue (RG-022-04) : retourne `null` dans les deux cas
 * plutôt que de propager une exception.
 */
export function readStoredLanguage(): Language | null {
  try {
    const raw = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return raw === 'fr' || raw === 'en' ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Recopie la langue enregistrée dans `localStorage` (RG-022-04), à chaque
 * chargement des paramètres. Silencieux si `localStorage` est indisponible
 * (mode privé, quota) : l'état en mémoire reste correct pour la session en
 * cours.
 */
export function writeStoredLanguage(language: Language): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // localStorage indisponible : rien à persister, sans erreur visible.
  }
}
