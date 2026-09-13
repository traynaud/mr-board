import { Language } from '../../models/settings.model';

/**
 * Formate une date ISO (`YYYY-MM-DD` ou date-heure) en `JJ/MM/AAAA` (`fr`)
 * ou `AAAA-MM-JJ` (`en`, ISO, non ambigu — RG-022-10).
 * @returns la chaîne d'origine si elle n'est pas interprétable.
 */
export function formatShortDate(iso: string, language: Language = 'fr'): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) {
    return iso;
  }
  const [, year, month, day] = match;
  return language === 'en' ? `${year}-${month}-${day}` : `${day}/${month}/${year}`;
}

/**
 * Formate une date-heure ISO en `JJ/MM/AAAA HH:mm` (`fr`) ou `AAAA-MM-JJ HH:mm`
 * (`en`, RG-022-10), dans le fuseau horaire local du navigateur (RG-007-04) —
 * à la différence de `formatShortDate`, convertit réellement l'instant
 * (`Date` natif, pas de parsing texte).
 * @returns la chaîne d'origine si elle n'est pas interprétable.
 */
export function formatDateTime(iso: string, language: Language = 'fr'): string {
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
  return language === 'en'
    ? `${year}-${month}-${day} ${hours}:${minutes}`
    : `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Formate une date-heure ISO en `HH:mm`, dans le fuseau horaire local du
 * navigateur (US-013, tooltip « Prochaine synchro »). Identique dans les
 * deux langues (RG-022-10) : ne prend volontairement pas de paramètre de
 * langue.
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
