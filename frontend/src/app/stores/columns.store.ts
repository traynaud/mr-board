import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';

export interface ColumnsState {
  /** Visibilité de la colonne optionnelle « Statut » (RG-017-09). Visible par défaut. */
  showStatus: boolean;
  /** Visibilité de la colonne optionnelle « Date d'ouverture » (RG-011-09). Masquée par défaut. */
  showOpened: boolean;
}

const initialState: ColumnsState = {
  showStatus: true,
  showOpened: false,
};

/**
 * Visibilité des colonnes optionnelles du tableau (RG-011-09/10/11,
 * RG-017-09). État UI pur — aucun appel HTTP, aucune persistance hors de
 * l'URL (RG-011-11).
 */
export const ColumnsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => ({
    /** RG-017-09 : bascule la visibilité de la colonne « Statut ». */
    toggleStatus(): void {
      patchState(store, { showStatus: !store.showStatus() });
    },

    /** RG-011-09 : bascule la visibilité de la colonne « Date d'ouverture ». */
    toggleOpened(): void {
      patchState(store, { showOpened: !store.showOpened() });
    },

    /** RG-011-02 : restaure l'état depuis l'URL au chargement. */
    restore(showStatus: boolean, showOpened: boolean): void {
      patchState(store, { showStatus, showOpened });
    },
  })),
);
