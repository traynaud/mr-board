import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

export type ResizableColumnKey =
  | 'project'
  | 'author'
  | 'labels'
  | 'difficulty'
  | 'comments'
  | 'reviewer'
  | 'assignee'
  | 'approved'
  | 'status'
  | 'ready'
  | 'opened';

/** RG-005-02, RG-017-07, RG-028-09 : largeurs initiales des colonnes, reprises du prototype de référence. */
export const DEFAULT_COLUMN_WIDTHS: Record<ResizableColumnKey, number> = {
  project: 64,
  author: 52,
  labels: 160,
  difficulty: 150,
  comments: 44,
  reviewer: 72,
  assignee: 72,
  approved: 76,
  status: 64,
  ready: 118,
  opened: 120,
};

const RESIZABLE_COLUMN_KEYS: readonly ResizableColumnKey[] = Object.keys(
  DEFAULT_COLUMN_WIDTHS,
) as ResizableColumnKey[];

/** RG-012-02 : bornes de largeur, en pixels. */
const MIN_WIDTH = 40;
const MAX_WIDTH = 800;

const STORAGE_KEY = 'mrboard.columns.v1';

export interface ColumnWidthsState {
  /** Uniquement les colonnes explicitement redimensionnées (RG-012-03). */
  overrides: Partial<Record<ResizableColumnKey, number>>;
}

/**
 * Largeurs des colonnes du tableau (RG-012-01/02/03/04). État UI pur,
 * persisté dans `localStorage` (jamais dans l'URL, à la différence de
 * `ColumnsStore` — RG-012-03) ; toute lecture/écriture est résiliente à un
 * `localStorage` indisponible (mode privé, quota, etc.) : le tableau
 * fonctionne alors avec les largeurs par défaut, sans erreur visible.
 */
export const ColumnWidthsStore = signalStore(
  { providedIn: 'root' },
  // Factory (pas un objet figé) : relit `localStorage` à chaque instanciation
  // du store plutôt qu'une seule fois au chargement du module.
  withState<ColumnWidthsState>(() => ({ overrides: loadOverrides() })),
  withComputed((store) => ({
    /** Largeurs effectives complètes (défauts + overrides) — seul signal consommé par les composants. */
    widths: computed<Record<ResizableColumnKey, number>>(() => ({
      ...DEFAULT_COLUMN_WIDTHS,
      ...store.overrides(),
    })),
  })),
  withMethods((store) => ({
    /** RG-012-01/02 : glisser ou flèche clavier — borne `[40, 800]` et persiste. */
    setWidth(key: ResizableColumnKey, width: number): void {
      const overrides = { ...store.overrides(), [key]: clamp(width) };
      patchState(store, { overrides });
      saveOverrides(overrides);
    },

    /** RG-012-04 : double-clic sur une poignée, ne réinitialise que cette colonne. */
    resetOne(key: ResizableColumnKey): void {
      const overrides = { ...store.overrides() };
      delete overrides[key];
      patchState(store, { overrides });
      saveOverrides(overrides);
    },

    /** RG-012-04/05 : item de menu « Réinitialiser les largeurs », toutes colonnes. */
    resetAll(): void {
      patchState(store, { overrides: {} });
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // localStorage indisponible : rien à nettoyer, sans erreur visible.
      }
    },
  })),
);

function clamp(width: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
}

function saveOverrides(overrides: Partial<Record<ResizableColumnKey, number>>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // localStorage indisponible : l'état en mémoire reste correct pour la session en cours.
  }
}

/**
 * Lecture initiale, tolérante à toute corruption (JSON invalide, valeurs
 * hors bornes, clés inconnues, `localStorage` indisponible) : réduite à
 * `{}` (largeurs par défaut) plutôt que de propager une exception.
 */
function loadOverrides(): Partial<Record<ResizableColumnKey, number>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return {};
    }
    const overrides: Partial<Record<ResizableColumnKey, number>> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (
        isResizableColumnKey(key) &&
        typeof value === 'number' &&
        value >= MIN_WIDTH &&
        value <= MAX_WIDTH
      ) {
        overrides[key] = value;
      }
    }
    return overrides;
  } catch {
    return {};
  }
}

function isResizableColumnKey(key: string): key is ResizableColumnKey {
  return (RESIZABLE_COLUMN_KEYS as readonly string[]).includes(key);
}
