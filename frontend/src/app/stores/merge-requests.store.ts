import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { errorKeyOf } from '../core/api/api-error';
import { MergeRequestsService } from '../core/api/merge-requests.service';
import { MergeRequestView } from '../models/merge-request.model';

export interface MergeRequestsState {
  mergeRequests: MergeRequestView[];
  loading: boolean;
  /** Clé i18n de l'erreur de chargement. */
  loadError: string | null;
}

const initialState: MergeRequestsState = {
  mergeRequests: [],
  loading: false,
  loadError: null,
};

/**
 * État des MRs synchronisées (RG-005-*). `load()` ne vide jamais
 * `mergeRequests` avant que la nouvelle réponse arrive, ni en cas d'échec
 * (RG-005-05, RG-005-07) — même convention que `SettingsStore`/`ProjectsStore`.
 */
export const MergeRequestsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(MergeRequestsService)) => ({
    /** Charge la liste des MRs ouvertes (RG-005-01). */
    async load(): Promise<void> {
      patchState(store, { loading: true, loadError: null });
      try {
        const mergeRequests = await firstValueFrom(api.getMergeRequests());
        patchState(store, { mergeRequests, loading: false });
      } catch (error) {
        patchState(store, { loading: false, loadError: errorKeyOf(error) });
      }
    },
  })),
);
