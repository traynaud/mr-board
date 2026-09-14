import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';

export interface ColumnsState {
  /** Visibilité de la colonne optionnelle « Statut » (RG-017-09). Visible par défaut. */
  showStatus: boolean;
  /** Visibilité de la colonne optionnelle « Date d'ouverture » (RG-011-09). Masquée par défaut. */
  showOpened: boolean;
  /** Visibilité de la colonne optionnelle « Labels » (RG-028-05). Masquée par défaut. */
  showLabels: boolean;
}

const initialState: ColumnsState = {
  showStatus: true,
  showOpened: false,
  showLabels: false,
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

    /** RG-028-05 : bascule la visibilité de la colonne « Labels ». */
    toggleLabels(): void {
      patchState(store, { showLabels: !store.showLabels() });
    },

    /** RG-011-02 : restaure l'état depuis l'URL au chargement. */
    restore(showStatus: boolean, showOpened: boolean, showLabels: boolean): void {
      patchState(store, { showStatus, showOpened, showLabels });
    },
  })),
);
