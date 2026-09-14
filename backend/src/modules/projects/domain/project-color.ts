/**
 * Closed palette of background colors selectable for a project (RG-025-01,
 * RG-025-02). The backend only ever stores/validates one of these ids —
 * the actual hex values (background/text) are a frontend presentation
 * detail (`shared/project-color/project-color-palette.ts`).
 */
export const PROJECT_COLOR_IDS = [
  'slate',
  'sage',
  'lilac',
  'peach',
  'rose',
  'sand',
  'mint',
  'steel',
  'plum',
  'olive',
] as const;

export type ProjectColorId = (typeof PROJECT_COLOR_IDS)[number];
