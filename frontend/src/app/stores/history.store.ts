import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { errorKeyOf } from '../core/api/api-error';
import { HistoryService } from '../core/api/history.service';
import { activeKeysOf } from '../core/url-state/history-query-params';
import {
  EMPTY_HISTORY_FILTERS,
  HistoryActorOption,
  HistoryEvent,
  HistoryEventType,
  HistoryFilterKey,
  HistoryFilters,
} from '../models/history.model';

export interface HistoryState {
  events: HistoryEvent[];
  /** Nombre d'événements correspondant aux filtres (RG-038-11). */
  total: number;
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  /** Clé i18n de la dernière erreur de chargement. */
  error: string | null;
  /** Filtres appliqués à la timeline (RG-038-01). */
  filters: HistoryFilters;
  /** Pastilles affichées, valeur ou non (RG-038-12). */
  activeKeys: HistoryFilterKey[];
  /** Acteurs proposés par le filtre Acteur (RG-038-07). */
  actorOptions: HistoryActorOption[];
}

const initialState: HistoryState = {
  events: [],
  total: 0,
  nextCursor: null,
  loading: false,
  loadingMore: false,
  error: null,
  filters: EMPTY_HISTORY_FILTERS,
  activeKeys: [],
  actorOptions: [],
};

/** Ajoute `value` à `values` s'il est absent, le retire sinon. */
function toggled<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

/** État de la timeline d'historique (RG-037-*, RG-038-*) : première page puis pages suivantes par curseur. */
export const HistoryStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(HistoryService)) => {
    /** Numéro de la dernière requête de liste : une réponse plus ancienne est ignorée (RG-038-10). */
    let latestRequest = 0;

    async function load(): Promise<void> {
      const request = ++latestRequest;
      patchState(store, { loading: true, loadingMore: false, error: null });
      try {
        const page = await firstValueFrom(api.getHistory(null, undefined, store.filters()));
        if (request !== latestRequest) {
          return;
        }
        patchState(store, {
          events: page.events,
          total: page.total,
          nextCursor: page.nextCursor,
          loading: false,
        });
      } catch (error) {
        if (request !== latestRequest) {
          return;
        }
        patchState(store, {
          events: [],
          total: 0,
          nextCursor: null,
          loading: false,
          error: errorKeyOf(error),
        });
      }
    }

    /** Remplace les filtres puis recharge depuis la première page (RG-038-10). */
    function applyFilters(filters: HistoryFilters, activeKeys: HistoryFilterKey[]): Promise<void> {
      patchState(store, { filters, activeKeys });
      return load();
    }

    return {
      /** Recharge la timeline depuis la première page, filtres courants conservés. */
      load,

      /** Ajoute la page suivante (RG-037-03). Sans effet sans curseur ou pendant un chargement. */
      async loadMore(): Promise<void> {
        const cursor = store.nextCursor();
        if (!cursor || store.loading() || store.loadingMore()) {
          return;
        }
        const request = latestRequest;
        patchState(store, { loadingMore: true, error: null });
        try {
          const page = await firstValueFrom(api.getHistory(cursor, undefined, store.filters()));
          if (request !== latestRequest) {
            return;
          }
          patchState(store, {
            events: [...store.events(), ...page.events],
            total: page.total,
            nextCursor: page.nextCursor,
            loadingMore: false,
          });
        } catch (error) {
          if (request !== latestRequest) {
            return;
          }
          patchState(store, { loadingMore: false, error: errorKeyOf(error) });
        }
      },

      /** Charge les acteurs du filtre Acteur ; une erreur laisse la liste vide (le filtre reste utilisable). */
      async loadActors(): Promise<void> {
        try {
          patchState(store, { actorOptions: await firstValueFrom(api.getActors()) });
        } catch {
          patchState(store, { actorOptions: [] });
        }
      },

      /** Restaure les filtres (ex. depuis l'URL) sans recharger : à suivre d'un `load()`. */
      restoreFilters(filters: HistoryFilters): void {
        patchState(store, { filters, activeKeys: activeKeysOf(filters) });
      },

      /** Recherche libre (RG-038-05) ; le debounce est porté par la barre. */
      setSearch(search: string): Promise<void> {
        return applyFilters({ ...store.filters(), search }, store.activeKeys());
      },

      /** Coche / décoche un type d'événement (OU entre les types, RG-038-02). */
      toggleType(type: HistoryEventType): Promise<void> {
        return applyFilters(
          { ...store.filters(), types: toggled(store.filters().types, type) },
          store.activeKeys(),
        );
      },

      /** Coche / décoche un acteur (`UNKNOWN_ACTOR` pour « Inconnu », RG-038-07). */
      toggleActor(username: string): Promise<void> {
        return applyFilters(
          { ...store.filters(), actors: toggled(store.filters().actors, username) },
          store.activeKeys(),
        );
      },

      /** Coche / décoche un projet. */
      toggleProject(projectId: number): Promise<void> {
        return applyFilters(
          { ...store.filters(), projects: toggled(store.filters().projects, projectId) },
          store.activeKeys(),
        );
      },

      /** Définit la période en jours locaux inclus (RG-038-09). */
      setPeriod(from: string | null, to: string | null): Promise<void> {
        return applyFilters({ ...store.filters(), from, to }, store.activeKeys());
      },

      /** Affiche une pastille sans valeur : n'exclut rien, pas de rechargement (RG-038-12). */
      addFilter(key: HistoryFilterKey): void {
        if (!store.activeKeys().includes(key)) {
          patchState(store, { activeKeys: [...store.activeKeys(), key] });
        }
      },

      /** Retire la pastille et la valeur de son filtre (RG-038-12). */
      removeFilter(key: HistoryFilterKey): Promise<void> {
        const filters = { ...store.filters() };
        switch (key) {
          case 'type':
            filters.types = [];
            break;
          case 'actor':
            filters.actors = [];
            break;
          case 'project':
            filters.projects = [];
            break;
          case 'period':
            filters.from = null;
            filters.to = null;
            break;
        }
        return applyFilters(
          filters,
          store.activeKeys().filter((active) => active !== key),
        );
      },

      /** Retire tous les filtres, recherche comprise (RG-038-12). */
      clearFilters(): Promise<void> {
        return applyFilters(EMPTY_HISTORY_FILTERS, []);
      },
    };
  }),
);
