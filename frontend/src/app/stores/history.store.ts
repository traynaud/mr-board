import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { errorKeyOf } from '../core/api/api-error';
import { HistoryService } from '../core/api/history.service';
import { HistoryEvent } from '../models/history.model';

export interface HistoryState {
  events: HistoryEvent[];
  total: number;
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  /** Clé i18n de la dernière erreur de chargement. */
  error: string | null;
}

const initialState: HistoryState = {
  events: [],
  total: 0,
  nextCursor: null,
  loading: false,
  loadingMore: false,
  error: null,
};

/** État de la timeline d'historique (RG-037-*) : première page puis pages suivantes par curseur. */
export const HistoryStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(HistoryService)) => ({
    /** Recharge la timeline depuis la première page. */
    async load(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const page = await firstValueFrom(api.getHistory(null));
        patchState(store, {
          events: page.events,
          total: page.total,
          nextCursor: page.nextCursor,
          loading: false,
        });
      } catch (error) {
        patchState(store, { loading: false, error: errorKeyOf(error) });
      }
    },

    /** Ajoute la page suivante (RG-037-03). Sans effet sans curseur ou pendant un chargement. */
    async loadMore(): Promise<void> {
      const cursor = store.nextCursor();
      if (!cursor || store.loading() || store.loadingMore()) {
        return;
      }
      patchState(store, { loadingMore: true, error: null });
      try {
        const page = await firstValueFrom(api.getHistory(cursor));
        patchState(store, {
          events: [...store.events(), ...page.events],
          total: page.total,
          nextCursor: page.nextCursor,
          loadingMore: false,
        });
      } catch (error) {
        patchState(store, { loadingMore: false, error: errorKeyOf(error) });
      }
    },
  })),
);
