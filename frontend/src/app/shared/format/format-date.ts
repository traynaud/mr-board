/**
 * Formate une date ISO (`YYYY-MM-DD` ou date-heure) en `JJ/MM/AAAA`.
 * @returns la chaîne d'origine si elle n'est pas interprétable.
 */
export function formatShortDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}

/**
 * Formate une date-heure ISO en `JJ/MM/AAAA HH:mm`, dans le fuseau horaire
 * local du navigateur (RG-007-04) — à la différence de `formatShortDate`,
 * convertit réellement l'instant (`Date` natif, pas de parsing texte).
 * @returns la chaîne d'origine si elle n'est pas interprétable.
 */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const pad = (n: number): string => n.toString().padStart(2, '0');
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear();
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Formate une date-heure ISO en `HH:mm`, dans le fuseau horaire local du
 * navigateur (US-013, tooltip « Prochaine synchro »).
 * @returns la chaîne d'origine si elle n'est pas interprétable.
 */
export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
