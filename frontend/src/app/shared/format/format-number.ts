import { Language } from '../../models/settings.model';

/**
 * Formate un nombre entier avec un séparateur de milliers dépendant de la
 * langue (RG-022-10) : espace en `fr` (« 1 240 »), virgule en `en`
 * (« 1,240 »). Implémentation manuelle (pas d'`Intl`) pour un résultat
 * déterministe, indépendant de l'ICU du runtime.
 */
export function formatThousands(n: number, language: Language = 'fr'): string {
  const sign = n < 0 ? '-' : '';
  const digits = Math.abs(n).toString();
  const separator = language === 'en' ? ',' : ' ';
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}
