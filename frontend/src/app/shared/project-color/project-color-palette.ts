/**
 * Closed palette of background colors selectable for a project (RG-025-01,
 * RG-025-02) — a deliberate, documented exception to the single-accent rule
 * of `docs/tech/design-system.md` (see US-025 specs §4). Mirrors the backend
 * `PROJECT_COLOR_IDS` (`backend/src/modules/projects/domain/project-color.ts`)
 * — the two lists must be kept in sync manually.
 */
export type ProjectColorId =
  | 'slate'
  | 'sage'
  | 'lilac'
  | 'peach'
  | 'rose'
  | 'sand'
  | 'mint'
  | 'steel'
  | 'plum'
  | 'olive';

/** One palette entry — `text` is fixed, independent of the active theme (RG-025-05). */
export interface ProjectColorSwatch {
  id: ProjectColorId;
  background: string;
  text: string;
  /** i18n key of the color's display name (`settings.connections.repos.colors.<id>`). */
  labelKey: string;
}

export const PROJECT_COLOR_PALETTE: ProjectColorSwatch[] = [
  { id: 'slate', background: '#c7d9ea', text: '#20303f', labelKey: 'settings.connections.repos.colors.slate' },
  { id: 'sage', background: '#c8ddc7', text: '#25381f', labelKey: 'settings.connections.repos.colors.sage' },
  { id: 'lilac', background: '#dcd3ea', text: '#332a4a', labelKey: 'settings.connections.repos.colors.lilac' },
  { id: 'peach', background: '#f0d9c4', text: '#4a2f14', labelKey: 'settings.connections.repos.colors.peach' },
  { id: 'rose', background: '#f0d3d9', text: '#4a1f28', labelKey: 'settings.connections.repos.colors.rose' },
  { id: 'sand', background: '#ece0c4', text: '#43391a', labelKey: 'settings.connections.repos.colors.sand' },
  { id: 'mint', background: '#c9e5dd', text: '#173d31', labelKey: 'settings.connections.repos.colors.mint' },
  { id: 'steel', background: '#cbd4dc', text: '#28333d', labelKey: 'settings.connections.repos.colors.steel' },
  { id: 'plum', background: '#e3cfe0', text: '#3d2038', labelKey: 'settings.connections.repos.colors.plum' },
  { id: 'olive', background: '#dde0c2', text: '#353a17', labelKey: 'settings.connections.repos.colors.olive' },
];

/** Resolves a stored color id to its palette entry, `null` for "Aucune" or an unknown id (RG-025-01). */
export function findProjectColor(id: string | null | undefined): ProjectColorSwatch | null {
  if (!id) {
    return null;
  }
  return PROJECT_COLOR_PALETTE.find((swatch) => swatch.id === id) ?? null;
}
