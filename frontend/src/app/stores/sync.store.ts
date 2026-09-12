import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { SyncService } from '../core/api/sync.service';
import { SyncRun } from '../models/sync-status.model';

export interface SyncState {
  running: boolean;
  lastRun: SyncRun | null;
  /** Prochaine échéance de synchro planifiée, `null` en mode manuel (RG-013-07). */
  nextRunAt: string | null;
  loading: boolean;
}

const initialState: SyncState = {
  running: false,
  lastRun: null,
  nextRunAt: null,
  loading: false,
};

/** Intervalle de `GET /sync/status` pendant une synchronisation (RG-004-08). */
export const POLL_RUNNING_MS = 5_000;
/** Intervalle de `GET /sync/status` en dehors d'une synchronisation (RG-004-08). */
export const POLL_IDLE_MS = 60_000;

/**
 * État de la synchronisation GitLab (RG-004-*) et polling de son statut.
 * Le polling n'est actif que pendant que l'écran Tableau est affiché
 * (`startPolling()`/`stopPolling()` pilotés par `BoardPageComponent`).
 */
export const SyncStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(SyncService)) => {
    let pollActive = false;
    let pollHandle: ReturnType<typeof setTimeout> | null = null;

    async function loadStatus(): Promise<void> {
      patchState(store, { loading: true });
      try {
        const status = await firstValueFrom(api.getStatus());
        patchState(store, {
          running: status.running,
          lastRun: status.lastRun,
          nextRunAt: status.nextRunAt,
          loading: false,
        });
      } catch {
        patchState(store, { loading: false });
      }
    }

    function scheduleNextPoll(): void {
      if (!pollActive) {
        return;
      }
      const delay = store.running() ? POLL_RUNNING_MS : POLL_IDLE_MS;
      pollHandle = setTimeout(() => {
        void loadStatus().then(scheduleNextPoll);
      }, delay);
    }

    return {
      loadStatus,

      /**
       * Déclenche une synchronisation. Point d'entrée unique pour le bouton
       * Rafraîchir et les deux déclenchements automatiques (RG-004-15) :
       * rafraîchit immédiatement le statut après la réponse du `POST`, ce
       * qui permet au bouton de se désactiver sans attendre le prochain
       * tick du polling (RG-004-09). Les échecs de déclenchement sont
       * ignorés : le contrat `POST /sync` ne renvoie pas d'erreur métier
       * (RG-004-07) et un appel "best effort" ne doit jamais faire échouer
       * l'action qui l'a provoqué (sauvegarde des paramètres, ajout d'un repo).
       */
      async trigger(projectId?: number): Promise<void> {
        try {
          await firstValueFrom(api.postSync(projectId));
        } catch {
          // Ignoré volontairement, voir JSDoc ci-dessus.
        }
        await loadStatus();
      },

      /** Démarre le polling de statut (5 s en cours, 60 s sinon, RG-004-08). */
      startPolling(): void {
        pollActive = true;
        void loadStatus().then(scheduleNextPoll);
      },

      /** Arrête le polling (quitte l'écran Tableau). */
      stopPolling(): void {
        pollActive = false;
        if (pollHandle !== null) {
          clearTimeout(pollHandle);
          pollHandle = null;
        }
      },
    };
  }),
);
