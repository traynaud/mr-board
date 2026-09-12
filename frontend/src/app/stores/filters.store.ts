import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import {
  ComposableFilters,
  FilterKey,
  MergeRequestFilters,
  isMultiValueFilter,
} from '../models/merge-request.model';

export interface FiltersState extends MergeRequestFilters {
  /** Filtres composables actifs (pastilles affichées), dans l'ordre d'ajout (RG-010-03). */
  active: FilterKey[];
  project: string[];
  author: string[];
  assigned: string[];
  approved: 'yes' | 'no' | null;
  commented: 'yes' | 'no' | null;
}

const initialState: FiltersState = {
  drafts: false,
  mine: false,
  active: [],
  project: [],
  author: [],
  assigned: [],
  approved: null,
  commented: null,
};

const EMPTY_MULTI_VALUE: readonly string[] = [];

/**
 * État des filtres rapides (RG-009-01/02) et des 5 filtres composables
 * (RG-010-*) : « Drafts » masqués et « Mes MRs » désactivé par défaut,
 * aucune pastille active. État UI pur — aucun appel HTTP, aucune
 * dépendance à `MergeRequestsStore` (qui, lui, lit ce store ; éviter une
 * injection croisée qui créerait un cycle de DI, voir archi.md).
 */
export const FiltersStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    /** Forme `ComposableFilters` attendue par l'API (RG-010-01). */
    composableFilters: computed<ComposableFilters>(() => ({
      project: store.project(),
      author: store.author(),
      assigned: store.assigned(),
      approved: store.approved(),
      commented: store.commented(),
    })),
  })),
  withMethods((store) => ({
    /** RG-009-01 : préférence d'affichage, jamais touchée par `clear()`. */
    toggleDrafts(): void {
      patchState(store, { drafts: !store.drafts() });
    },

    /** RG-009-02. */
    toggleMine(): void {
      patchState(store, { mine: !store.mine() });
    },

    /**
     * RG-011-02 : restaure l'état complet depuis l'URL au chargement — patch
     * direct en bloc, sans passer par les méthodes de toggle unitaires (qui
     * ont chacune leur propre logique de bascule, inadaptée à une
     * restauration one-shot).
     */
    restore(state: Partial<FiltersState>): void {
      patchState(store, state);
    },

    /** RG-010-03 : crée la pastille d'un filtre pas encore actif. Sans effet si déjà actif. */
    addFilter(key: FilterKey): void {
      if (store.active().includes(key)) {
        return;
      }
      patchState(store, { active: [...store.active(), key] });
    },

    /** RG-010-04 (croix) : retire la pastille et réinitialise la valeur du filtre. */
    removeFilter(key: FilterKey): void {
      patchState(store, {
        active: store.active().filter((k) => k !== key),
        ...(isMultiValueFilter(key) ? { [key]: EMPTY_MULTI_VALUE } : { [key]: null }),
      });
    },

    /** RG-010-02/05 : bascule `value` dans la sélection multi de `key` (OU entre valeurs). */
    toggleMultiValue(key: 'project' | 'author' | 'assigned', value: string): void {
      const current = store[key]();
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      patchState(store, { [key]: next });
    },

    /** RG-010-09 : remplace la sélection multi de `key` sans passer par un toggle (réconciliation). */
    setMultiValue(key: 'project' | 'author' | 'assigned', values: string[]): void {
      patchState(store, { [key]: values });
    },

    /** RG-010-06 : choisir ferme le menu ; re-cliquer la même option la désélectionne (valeur `null`). */
    setBoolean(key: 'approved' | 'commented', value: 'yes' | 'no'): void {
      patchState(store, { [key]: store[key]() === value ? null : value });
    },

    /** RG-009-05, RG-010-11 : retire toutes les pastilles et « Mes MRs », jamais « Drafts ». */
    clear(): void {
      patchState(store, {
        mine: false,
        active: [],
        project: [],
        author: [],
        assigned: [],
        approved: null,
        commented: null,
      });
    },
  })),
);
