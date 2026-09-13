import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { errorKeyOf } from '../core/api/api-error';
import { SettingsService } from '../core/api/settings.service';
import {
  ExportConfig,
  ImportConfig,
  ImportResult,
  Settings,
  UpdateSettingsRequest,
} from '../models/settings.model';

export interface SettingsState {
  settings: Settings | null;
  loading: boolean;
  /** Clé i18n de l'erreur de chargement. */
  loadError: string | null;
  saving: boolean;
}

const initialState: SettingsState = {
  settings: null,
  loading: false,
  loadError: null,
  saving: false,
};

/** État des préférences globales de l'application et actions associées (RG-019-23). */
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

    /**
     * Récupère la configuration exportable (RG-015-03).
     * @returns la configuration, ou la clé i18n de l'erreur en cas d'échec.
     */
    async exportConfig(): Promise<{ data: ExportConfig | null; errorKey: string | null }> {
      try {
        const data = await firstValueFrom(api.getExportConfig());
        return { data, errorKey: null };
      } catch (error) {
        return { data: null, errorKey: errorKeyOf(error) };
      }
    },

    /**
     * Importe une configuration (RG-015-04). Met à jour `settings` avec le
     * résultat en cas de succès, pour que la page puisse réinitialiser le
     * formulaire depuis l'état serveur à jour.
     * @returns le résultat, ou la clé i18n de l'erreur en cas d'échec.
     */
    async importConfig(
      request: ImportConfig,
    ): Promise<{ result: ImportResult | null; errorKey: string | null }> {
      try {
        const result = await firstValueFrom(api.postImportConfig(request));
        patchState(store, { settings: result.settings });
        return { result, errorKey: null };
      } catch (error) {
        return { result: null, errorKey: errorKeyOf(error) };
      }
    },
  })),
);
