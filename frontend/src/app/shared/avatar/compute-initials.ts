/**
 * Calcule des initiales (2 lettres max, majuscules) à partir d'un nom ou d'un
 * username, en découpant sur l'espace, `.`, `-` et `_` (RG-G12, RG-002-03bis).
 * Une chaîne vide (ou uniquement des séparateurs) renvoie `?`.
 *
 * Exemples : « Marie Dupont » → « MD » ; « Ana » → « A » ;
 * « marie.dupont » → « MD » ; « jean-paul » → « JP » ; « mdupont » → « M ».
 */
export function computeInitials(source: string): string {
  const words = source
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (words.length === 0) {
    return '?';
  }
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}
