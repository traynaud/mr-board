/** Plafond d'affichage des compteurs : au-delà, « 99+ » (RG-040-03). */
export const COUNTER_CAP = 99;

/** Texte d'un compteur de notifications : le nombre, ou « 99+ » au-delà du plafond. */
export function formatCounter(count: number): string {
  return count > COUNTER_CAP ? `${COUNTER_CAP}+` : String(count);
}
