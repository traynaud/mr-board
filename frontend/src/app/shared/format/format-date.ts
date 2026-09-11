/**
 * Formate une date ISO (`YYYY-MM-DD` ou date-heure) en `JJ/MM/AAAA`.
 * @returns la chaîne d'origine si elle n'est pas interprétable.
 */
export function formatShortDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}
