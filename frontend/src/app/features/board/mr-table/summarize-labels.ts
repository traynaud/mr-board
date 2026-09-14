export interface LabelsSummary {
  /** Les 2 premiers labels au plus (RG-028-07). */
  shown: string[];
  /** Nombre de labels au-delà des 2 premiers affichés. */
  extraCount: number;
  /** Tous les labels séparés par une virgule, pour l'infobulle (RG-028-07). */
  tooltip: string;
}

/** Au-delà de ce nombre, les labels excédentaires sont résumés par un jeton « +N » (RG-028-07, QO-028-03). */
const VISIBLE_LABELS = 2;

/** Résume la liste de labels d'une MR pour l'affichage « 2 premiers + N » (RG-028-07). */
export function summarizeLabels(labels: string[]): LabelsSummary {
  return {
    shown: labels.slice(0, VISIBLE_LABELS),
    extraCount: Math.max(0, labels.length - VISIBLE_LABELS),
    tooltip: labels.join(', '),
  };
}
