import { formatTime } from '../../shared/format/format-date';
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

/**
 * Détail des repos en échec du dernier run, pour l'infobulle du libellé de
 * synchro (RG-021-06) : `lastRun.errorMessage` réutilisé tel quel — il nomme
 * déjà la connexion et le repo en cause (RG-019-16, RG-020-*) — dès que le
 * run est `partial` ou `error`. `null` sinon (rien à montrer).
 */
export function computeSyncFailureDetail(lastRun: SyncRun | null): string | null {
  if (!lastRun || (lastRun.status !== 'partial' && lastRun.status !== 'error')) {
    return null;
  }
  return lastRun.errorMessage;
}

export interface NextRunTooltip {
  /** Clé i18n du tooltip de la toolbar (RG-013-07). */
  key: string;
  params?: { time: string };
}

/**
 * Calcule le tooltip « prochaine synchro » de la toolbar (RG-013-07).
 * @param nextRunAt échéance planifiée (ISO), `null` en mode manuel.
 */
export function computeNextRunTooltip(nextRunAt: string | null): NextRunTooltip {
  if (nextRunAt === null) {
    return { key: 'board.sync.manualTooltip' };
  }
  return {
    key: 'board.sync.nextRunTooltip',
    params: { time: formatTime(nextRunAt) },
  };
}
