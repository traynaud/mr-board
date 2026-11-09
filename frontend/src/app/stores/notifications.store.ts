import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { errorKeyOf } from '../core/api/api-error';
import { NotificationsService } from '../core/api/notifications.service';
import { HistoryEvent } from '../models/history.model';
import { SyncStore } from './sync.store';

export interface NotificationsState {
  /** Les plus récents événements à traiter (50 max, RG-040-07). */
  events: HistoryEvent[];
  /** Nombre exact d'événements à traiter ; l'affichage « 99+ » est du ressort du composant. */
  count: number;
  /** Jeton renvoyé par le serveur ; sa variation déclenche un rechargement de la liste. */
  revision: string | null;
  loading: boolean;
  /** Clé i18n de la dernière erreur de chargement. */
  error: string | null;
}

const initialState: NotificationsState = {
  events: [],
  count: 0,
  revision: null,
  loading: false,
  error: null,
};

/** Intervalle du polling pendant une synchronisation (aligné sur `SyncStore`, RG-004-08). */
export const NOTIFICATIONS_POLL_RUNNING_MS = 5_000;
/** Intervalle du polling hors synchronisation : capte la confirmation asynchrone des provisoires (RG-040-05). */
export const NOTIFICATIONS_POLL_IDLE_MS = 60_000;

/**
 * État du panneau de notifications (RG-040-*) : liste, compteur, fermeture
 * optimiste avec retour arrière, et rafraîchissement par révision.
 */
export const NotificationsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(NotificationsService), sync = inject(SyncStore)) => {
    let pollActive = false;
    let pollHandle: ReturnType<typeof setTimeout> | null = null;

    async function load(showLoading: boolean): Promise<void> {
      patchState(store, { loading: showLoading, error: null });
      try {
        const list = await firstValueFrom(api.getNotifications());
        patchState(store, {
          events: list.events,
          count: list.count,
          revision: list.revision,
          loading: false,
        });
      } catch (error) {
        patchState(store, { loading: false, error: errorKeyOf(error) });
      }
    }

    /** Ne recharge la liste que si la révision serveur a changé (RG-040-05). */
    async function refresh(): Promise<void> {
      try {
        const summary = await firstValueFrom(api.getSummary());
        if (summary.revision !== store.revision()) {
          await load(false);
        }
      } catch (error) {
        patchState(store, { error: errorKeyOf(error) });
      }
    }

    function scheduleNextPoll(): void {
      if (!pollActive) {
        return;
      }
      const delay = sync.running() ? NOTIFICATIONS_POLL_RUNNING_MS : NOTIFICATIONS_POLL_IDLE_MS;
      pollHandle = setTimeout(() => {
        void refresh().then(scheduleNextPoll);
      }, delay);
    }

    return {
      /** Charge la liste depuis le début, avec indicateur de chargement (ouverture du panneau, « Réessayer »). */
      load: () => load(true),

      refresh,

      /**
       * Marque un événement comme vu (RG-040-02/04) : il disparaît et le compteur
       * baisse aussitôt ; si l'appel échoue, l'état précédent est restauré.
       * @returns la clé i18n de l'erreur, ou `null` en cas de succès.
       */
      async dismiss(id: number): Promise<string | null> {
        const previous = { events: store.events(), count: store.count() };
        if (!previous.events.some((event) => event.id === id)) {
          return null;
        }
        patchState(store, {
          events: previous.events.filter((event) => event.id !== id),
          count: Math.max(0, previous.count - 1),
        });
        try {
          await firstValueFrom(api.postDismiss(id));
          return null;
        } catch (error) {
          patchState(store, previous);
          return errorKeyOf(error);
        }
      },

      /**
       * Marque tout comme vu (RG-040-02), y compris au-delà des entrées listées.
       * @returns la clé i18n de l'erreur, ou `null` en cas de succès.
       */
      async dismissAll(): Promise<string | null> {
        const previous = { events: store.events(), count: store.count() };
        patchState(store, { events: [], count: 0 });
        try {
          await firstValueFrom(api.postDismissAll());
          return null;
        } catch (error) {
          patchState(store, previous);
          return errorKeyOf(error);
        }
      },

      /** Démarre le rafraîchissement périodique (5 s pendant une synchro, 60 s sinon). */
      startPolling(): void {
        pollActive = true;
        void refresh().then(scheduleNextPoll);
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
