import { SyncRun } from '../../models/sync-status.model';

export interface SyncStatusLabel {
  /** Clé i18n à afficher dans la toolbar. */
  key: string;
  params?: { minutes: number };
  /** Vrai quand le libellé doit être affiché en couleur accent (RG-004-08). */
  accent: boolean;
}

/**
 * Calcule le libellé de statut de synchronisation affiché dans la toolbar
 * (RG-004-08). Recalculé côté frontend toutes les 30 s sans nouvel appel
 * réseau : `nowMs` est le seul paramètre qui varie d'un appel à l'autre une
 * fois `running`/`lastRun` stables.
 * @param state `running`/`lastRun` du `SyncStore`.
 * @param nowMs horodatage courant (epoch ms), injecté pour la testabilité.
 */
export function computeSyncStatusLabel(
  state: { running: boolean; lastRun: SyncRun | null },
  nowMs: number,
): SyncStatusLabel {
  if (state.running) {
    return { key: 'board.sync.syncing', accent: true };
  }
  if (!state.lastRun) {
    return { key: 'board.sync.never', accent: false };
  }
  const minutes = Math.max(
    0,
    Math.floor((nowMs - new Date(state.lastRun.finishedAt).getTime()) / 60_000),
  );
  if (state.lastRun.status === 'error') {
    return { key: 'board.sync.failedMinutesAgo', params: { minutes }, accent: true };
  }
  if (minutes < 1) {
    return { key: 'board.sync.justNow', accent: false };
  }
  return { key: 'board.sync.minutesAgo', params: { minutes }, accent: false };
}
