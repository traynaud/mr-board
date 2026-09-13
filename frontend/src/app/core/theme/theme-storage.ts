import { ThemePreference } from '../../models/settings.model';

/**
 * RG-018-05 : clé `localStorage` utilisée comme cache anti-flash. Dupliquée
 * en dur dans le script inline de `index.html` (qui s'exécute avant tout
 * bundle JS et ne peut donc pas importer cette constante) — garder les deux
 * synchronisées en cas de renommage.
 */
export const THEME_STORAGE_KEY = 'mrboard.theme.v1';

/**
 * Lit la préférence de thème mise en cache, tolérante à un `localStorage`
 * indisponible ou à une valeur corrompue (RG-018-05) : retourne `null` dans
 * les deux cas plutôt que de propager une exception.
 */
export function readStoredTheme(): ThemePreference | null {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return raw === 'system' || raw === 'light' || raw === 'dark' ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Recopie la préférence enregistrée dans `localStorage` (RG-018-05), à
 * chaque chargement des paramètres. Silencieux si `localStorage` est
 * indisponible (mode privé, quota) : l'état en mémoire reste correct pour
 * la session en cours.
 */
export function writeStoredTheme(theme: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // localStorage indisponible : rien à persister, sans erreur visible.
  }
}
