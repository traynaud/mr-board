import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { MergeRequestFilters } from '../models/merge-request.model';

const initialState: MergeRequestFilters = {
  drafts: false,
  mine: false,
};

/**
 * État des filtres rapides (RG-009-01/02) : « Drafts » masqués et « Mes
 * MRs » désactivé par défaut. État UI pur — aucun appel HTTP, aucune
 * dépendance à `MergeRequestsStore` (qui, lui, lit ce store ; éviter une
 * injection croisée qui créerait un cycle de DI, voir archi.md).
 */
export const FiltersStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => ({
    /** RG-009-01 : préférence d'affichage, jamais touchée par `clear()`. */
    toggleDrafts(): void {
      patchState(store, { drafts: !store.drafts() });
    },

    /** RG-009-02. */
    toggleMine(): void {
      patchState(store, { mine: !store.mine() });
    },

    /** RG-009-05 : ne réinitialise que « Mes MRs », jamais « Drafts ». */
    clear(): void {
      patchState(store, { mine: false });
    },
  })),
);
