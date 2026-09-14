import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { errorKeyOf } from '../core/api/api-error';
import { MergeRequestsService } from '../core/api/merge-requests.service';
import { BrowserNotificationService } from '../core/notifications/browser-notification.service';
import {
  DEFAULT_SORT,
  MergeRequestSort,
  MergeRequestView,
  MergeRequestsFacets,
  SortKey,
} from '../models/merge-request.model';
import { findNewAssignments } from './assignment-diff';
import { ConnectionsStore } from './connections.store';
import { FiltersStore } from './filters.store';
import { SettingsStore } from './settings.store';

export interface MergeRequestsState {
  mergeRequests: MergeRequestView[];
  loading: boolean;
  /** Clé i18n de l'erreur de chargement. */
  loadError: string | null;
  sort: MergeRequestSort;
  /** Avertissements non bloquants renvoyés par l'API (ex. `identity.missing`, RG-009-02). */
  warnings: string[];
  /** Options et compteurs contextuels des 5 filtres composables (RG-010-07). */
  facets: MergeRequestsFacets | null;
}

/** RG-009-07 : les changements de filtre sont débounce avant de recharger. */
const FILTER_RELOAD_DEBOUNCE_MS = 150;
/** RG-026-09 : la recherche libre, elle, attend une frappe continue plus longtemps. */
export const SEARCH_RELOAD_DEBOUNCE_MS = 300;

const initialState: MergeRequestsState = {
  mergeRequests: [],
  loading: false,
  loadError: null,
  sort: DEFAULT_SORT,
  warnings: [],
  facets: null,
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
  withMethods(
    (
      store,
      api = inject(MergeRequestsService),
      filters = inject(FiltersStore),
      settingsStore = inject(SettingsStore),
      connectionsStore = inject(ConnectionsStore),
      notifications = inject(BrowserNotificationService),
    ) => {
      let reloadTimer: ReturnType<typeof setTimeout> | undefined;
      let hasLoadedOnce = false;

      async function load(): Promise<void> {
        const previous = store.mergeRequests();
        patchState(store, { loading: true, loadError: null });
        try {
          const baseFilters = {
            drafts: filters.drafts(),
            mine: filters.mine(),
            search: filters.search(),
          };
          const composableFilters = filters.composableFilters();
          const [{ mergeRequests, warnings }, facets] = await Promise.all([
            firstValueFrom(api.getMergeRequests(store.sort(), baseFilters, composableFilters)),
            firstValueFrom(api.getFacets(baseFilters, composableFilters)),
          ]);
          patchState(store, { mergeRequests, warnings, facets, loading: false });
          reconcileSelections(facets);
          notifyNewAssignments(previous, mergeRequests);
          hasLoadedOnce = true;
        } catch (error) {
          patchState(store, { loading: false, loadError: errorKeyOf(error) });
        }
      }

      /**
       * Notifie les nouvelles assignations (RG-016-01/02) : jamais au premier
       * chargement de la session (`hasLoadedOnce`), et seulement si l'option
       * est activée. Le corps nomme la connexion après l'alias dès qu'il en
       * existe au moins deux (RG-021-08).
       */
      function notifyNewAssignments(
        previous: MergeRequestView[],
        current: MergeRequestView[],
      ): void {
        const settings = settingsStore.settings();
        if (!hasLoadedOnce || !settings?.notifyAssigned) {
          return;
        }
        const showConnection = connectionsStore.connections().length > 1;
        for (const assignment of findNewAssignments(previous, current)) {
          const body = showConnection
            ? `[${assignment.connectionName} · ${assignment.projectAlias}] ${assignment.title}`
            : assignment.title;
          notifications.show(
            `MR Board — ${assignment.projectAlias} !${assignment.iid}`,
            body,
            () => window.open(assignment.webUrl, '_blank'),
          );
        }
      }

      /**
       * RG-010-09 : retire silencieusement, de chaque filtre multi-sélection,
       * toute valeur sélectionnée absente des options renvoyées par `facets`
       * (utilisateur disparu, alias renommé, connexion supprimée — RG-021-03).
       * `FiltersStore` reste un état UI pur, sans connaissance du serveur —
       * cette logique vit ici. `connection` compare en minuscules (RG-021-05)
       * pour ne pas purger à tort une valeur restaurée depuis l'URL dans une
       * casse différente de celle stockée (le backend, lui, la matcherait).
       */
      function reconcileSelections(facets: MergeRequestsFacets): void {
        for (const key of ['connection', 'project', 'author', 'assigned'] as const) {
          const caseInsensitive = key === 'connection';
          const known = new Set(
            facets[key].map((option) => (caseInsensitive ? option.value.toLowerCase() : option.value)),
          );
          const current = filters[key]();
          const pruned = current.filter((value) =>
            known.has(caseInsensitive ? value.toLowerCase() : value),
          );
          if (pruned.length !== current.length) {
            filters.setMultiValue(key, pruned);
          }
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
         * Restaure le tri depuis l'URL (RG-011-02) : patch direct, sans la
         * logique de bascule de `setSort` ni de rechargement — le premier
         * `load()` de `ngOnInit` s'en charge une fois tous les stores restaurés.
         */
        restoreSort(sort: MergeRequestSort): void {
          patchState(store, { sort });
        },

        /**
         * Recharge après un changement de filtre, avec un debounce de 150 ms
         * par défaut (RG-009-07) pour éviter une requête par filtre quand
         * plusieurs changent coup sur coup ; l'appelant passe
         * `SEARCH_RELOAD_DEBOUNCE_MS` pour la recherche libre (RG-026-09,
         * frappe continue) ou `0` quand elle redevient vide (rechargement
         * immédiat).
         */
        scheduleReload(debounceMs: number = FILTER_RELOAD_DEBOUNCE_MS): void {
          clearTimeout(reloadTimer);
          reloadTimer = setTimeout(() => void load(), debounceMs);
        },
      };
    },
  ),
);
