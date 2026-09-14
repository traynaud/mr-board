import { findProjectColor } from './project-color-palette';

/** Inline style resolved for a colored Projet tag. */
export interface ProjectTagStyle {
  background: string;
  color: string;
}

/**
 * Resolves the Projet tag's inline style for a repo color and MR draft state
 * (RG-025-03, RG-025-04). `null` when the repo has no color ("Aucune") — the
 * caller then falls back to the existing `.tag-neutral` style.
 * @param color repo's color id (`Project.color`), or `null`/`undefined`.
 * @param draft whether the MR is draft (RG-025-04 lightens the background;
 *   pass `false` for a non-MR context such as a filter option, RG-025-09).
 */
export function projectTagStyle(
  color: string | null | undefined,
  draft: boolean,
): ProjectTagStyle | null {
  const swatch = findProjectColor(color);
  if (!swatch) {
    return null;
  }
  return {
    background: draft ? hexToRgba(swatch.background, 0.45) : swatch.background,
    color: swatch.text,
  };
}

/** Converts a `#rrggbb` hex color to `rgba(r, g, b, alpha)`. */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
