import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { errorKeyOf } from '../core/api/api-error';
import { ConnectionsService } from '../core/api/connections.service';
import {
  Connection,
  CreateConnectionRequest,
  TestConnectionRequest,
  TestConnectionState,
  UpdateConnectionRequest,
} from '../models/connection.model';

export interface ConnectionsState {
  connections: Connection[];
  loading: boolean;
  /** Clé i18n de l'erreur de chargement. */
  loadError: string | null;
  saving: boolean;
  test: TestConnectionState;
  /**
   * Connexion visée par le dernier test (`null` pour un test lancé depuis le
   * formulaire d'ajout, sans connexion existante) — permet à la section
   * « 01 · Moi » de n'appliquer `test` qu'à la ligne concernée (RG-019-09).
   */
  testedConnectionId: number | null;
}

const IDLE_TEST: TestConnectionState = { status: 'idle', result: null, errorKey: null };

const initialState: ConnectionsState = {
  connections: [],
  loading: false,
  loadError: null,
  saving: false,
  test: IDLE_TEST,
  testedConnectionId: null,
};

/** État des connexions aux forges (RG-019-*) et actions associées. */
export const ConnectionsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(ConnectionsService)) => ({
    /** Charge la liste des connexions configurées. */
    async load(): Promise<void> {
      patchState(store, { loading: true, loadError: null });
      try {
        const connections = await firstValueFrom(api.getConnections());
        patchState(store, { connections, loading: false });
      } catch (error) {
        patchState(store, { loading: false, loadError: errorKeyOf(error) });
      }
    },

    /**
     * Ajoute une connexion (RG-019-01 à RG-019-03, immédiat).
     * @returns la clé i18n de l'erreur, ou `null` en cas de succès.
     */
    async add(request: CreateConnectionRequest): Promise<string | null> {
      patchState(store, { saving: true });
      try {
        const connection = await firstValueFrom(api.postConnection(request));
        patchState(store, {
          connections: [...store.connections(), connection],
          saving: false,
        });
        return null;
      } catch (error) {
        patchState(store, { saving: false });
        return errorKeyOf(error);
      }
    },

    /**
     * Modifie une connexion (RG-019-11, immédiat).
     * @returns la clé i18n de l'erreur, ou `null` en cas de succès.
     */
    async update(id: number, request: UpdateConnectionRequest): Promise<string | null> {
      patchState(store, { saving: true });
      try {
        const updated = await firstValueFrom(api.putConnection(id, request));
        patchState(store, {
          connections: store.connections().map((c) => (c.id === id ? updated : c)),
          saving: false,
        });
        return null;
      } catch (error) {
        patchState(store, { saving: false });
        return errorKeyOf(error);
      }
    },

    /**
     * Supprime une connexion (RG-019-13, immédiat).
     * @returns la clé i18n de l'erreur, ou `null` en cas de succès.
     */
    async remove(id: number): Promise<string | null> {
      try {
        await firstValueFrom(api.deleteConnection(id));
        patchState(store, { connections: store.connections().filter((c) => c.id !== id) });
        return null;
      } catch (error) {
        return errorKeyOf(error);
      }
    },

    /**
     * Teste une connexion et mémorise le résultat (RG-001-04, RG-019-14). Un
     * succès sur une connexion existante met aussi à jour son identité
     * résolue localement (RG-031-04), miroir de ce que le backend vient de
     * persister — sans re-charger toute la liste.
     */
    async testConnection(request: TestConnectionRequest): Promise<void> {
      patchState(store, {
        test: { status: 'pending', result: null, errorKey: null },
        testedConnectionId: request.connectionId ?? null,
      });
      try {
        const result = await firstValueFrom(api.postTestConnection(request));
        patchState(store, { test: { status: 'success', result, errorKey: null } });
        if (request.connectionId !== undefined) {
          const identity = {
            username: result.username,
            name: result.name,
            email: result.email,
            avatarUrl: result.avatarUrl,
          };
          patchState(store, {
            connections: store
              .connections()
              .map((c) => (c.id === request.connectionId ? { ...c, identity } : c)),
          });
        }
      } catch (error) {
        patchState(store, {
          test: { status: 'error', result: null, errorKey: errorKeyOf(error) },
        });
      }
    },

    /** Efface le résultat du test (RG-001-05). */
    resetTest(): void {
      if (store.test().status !== 'idle') {
        patchState(store, { test: IDLE_TEST, testedConnectionId: null });
      }
    },
  })),
);
