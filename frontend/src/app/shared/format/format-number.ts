/**
 * Formate un nombre entier avec un espace comme séparateur de milliers
 * (« 1 240 »). Implémentation manuelle (pas d'`Intl`) pour un résultat
 * déterministe, indépendant de l'ICU du runtime.
 */
export function formatThousands(n: number): string {
  const sign = n < 0 ? '-' : '';
  const digits = Math.abs(n).toString();
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
