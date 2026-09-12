import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { errorKeyOf } from '../core/api/api-error';
import { MergeRequestsService } from '../core/api/merge-requests.service';
import { MergeRequestSort, MergeRequestView, SortKey } from '../models/merge-request.model';
import { FiltersStore } from './filters.store';

export interface MergeRequestsState {
  mergeRequests: MergeRequestView[];
  loading: boolean;
  /** Clé i18n de l'erreur de chargement. */
  loadError: string | null;
  sort: MergeRequestSort;
  /** Avertissements non bloquants renvoyés par l'API (ex. `identity.missing`, RG-009-02). */
  warnings: string[];
}

/** RG-008-01/08 : tri par défaut, conservé le temps de la session en attendant l'URL (US-011). */
const DEFAULT_SORT: MergeRequestSort = { key: 'ready', direction: 'asc' };

/** RG-009-07 : les changements de filtre sont débounce avant de recharger. */
const FILTER_RELOAD_DEBOUNCE_MS = 150;

const initialState: MergeRequestsState = {
  mergeRequests: [],
  loading: false,
  loadError: null,
  sort: DEFAULT_SORT,
  warnings: [],
};

/**
 * État des MRs synchronisées (RG-005-*), de leur tri (RG-008-*) et des
 * filtres rapides (RG-009-*). `load()` ne vide jamais `mergeRequests` avant
 * que la nouvelle réponse arrive, ni en cas d'échec (RG-005-05, RG-005-07)
 * — même convention que `SettingsStore`/`ProjectsStore`.
 */
export const MergeRequestsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(MergeRequestsService), filters = inject(FiltersStore)) => {
    let reloadTimer: ReturnType<typeof setTimeout> | undefined;

    async function load(): Promise<void> {
      patchState(store, { loading: true, loadError: null });
      try {
        const { mergeRequests, warnings } = await firstValueFrom(
          api.getMergeRequests(store.sort(), {
            drafts: filters.drafts(),
            mine: filters.mine(),
          }),
        );
        patchState(store, { mergeRequests, warnings, loading: false });
      } catch (error) {
        patchState(store, { loading: false, loadError: errorKeyOf(error) });
      }
    }

    return {
      /** Charge la liste des MRs ouvertes, triées et filtrées (RG-005-01, RG-008-07, RG-009-01/02). */
      load,

      /**
       * Change le tri (RG-008-03) : colonne différente → ascendant ; même
       * colonne ascendante → descendant ; même colonne descendante →
       * ascendant. Recharge systématiquement (le tri est appliqué côté
       * backend).
       */
      setSort(key: SortKey): void {
        const current = store.sort();
        const direction = current.key === key && current.direction === 'asc' ? 'desc' : 'asc';
        patchState(store, { sort: { key, direction } });
        void load();
      },

      /**
       * Recharge après un changement de filtre, avec un debounce de 150 ms
       * (RG-009-07) pour éviter une requête par filtre quand plusieurs
       * changent coup sur coup.
       */
      scheduleReload(): void {
        clearTimeout(reloadTimer);
        reloadTimer = setTimeout(() => void load(), FILTER_RELOAD_DEBOUNCE_MS);
      },
    };
  }),
);
