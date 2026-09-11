import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { errorKeyOf } from '../core/api/api-error';
import { SettingsService } from '../core/api/settings.service';
import {
  Settings,
  TestConnectionRequest,
  TestConnectionResult,
  UpdateSettingsRequest,
} from '../models/settings.model';

/** État du test de connexion GitLab. */
export interface TestConnectionState {
  status: 'idle' | 'pending' | 'success' | 'error';
  result: TestConnectionResult | null;
  /** Clé i18n de l'erreur (`errors.*`). */
  errorKey: string | null;
}

export interface SettingsState {
  settings: Settings | null;
  loading: boolean;
  /** Clé i18n de l'erreur de chargement. */
  loadError: string | null;
  saving: boolean;
  test: TestConnectionState;
}

const IDLE_TEST: TestConnectionState = { status: 'idle', result: null, errorKey: null };

const initialState: SettingsState = {
  settings: null,
  loading: false,
  loadError: null,
  saving: false,
  test: IDLE_TEST,
};

/** État des paramètres de l'application et actions associées. */
export const SettingsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(SettingsService)) => ({
    /** Charge les paramètres depuis le backend. */
    async load(): Promise<void> {
      patchState(store, { loading: true, loadError: null });
      try {
        const settings = await firstValueFrom(api.getSettings());
        patchState(store, { settings, loading: false });
      } catch (error) {
        patchState(store, { loading: false, loadError: errorKeyOf(error) });
      }
    },

    /**
     * Enregistre les paramètres.
     * @returns la clé i18n de l'erreur, ou `null` en cas de succès.
     */
    async save(request: UpdateSettingsRequest): Promise<string | null> {
      patchState(store, { saving: true });
      try {
        const settings = await firstValueFrom(api.putSettings(request));
        patchState(store, { settings, saving: false });
        return null;
      } catch (error) {
        patchState(store, { saving: false });
        return errorKeyOf(error);
      }
    },

    /** Teste la connexion GitLab et mémorise le résultat. */
    async testConnection(request: TestConnectionRequest): Promise<void> {
      patchState(store, { test: { status: 'pending', result: null, errorKey: null } });
      try {
        const result = await firstValueFrom(api.postTestConnection(request));
        patchState(store, { test: { status: 'success', result, errorKey: null } });
      } catch (error) {
        patchState(store, {
          test: { status: 'error', result: null, errorKey: errorKeyOf(error) },
        });
      }
    },

    /** Efface le résultat du test (RG-001-05). */
    resetTest(): void {
      if (store.test().status !== 'idle') {
        patchState(store, { test: IDLE_TEST });
      }
    },
  })),
);
