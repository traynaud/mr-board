export type Difficulty = 'easy' | 'medium' | 'hard';

export interface DifficultyThresholds {
  easyFiles: number;
  easyLines: number;
  hardFiles: number;
  hardLines: number;
}

/**
 * Default thresholds of RG-G03. Used as-is until US-014 lets the user
 * configure them — only the caller (`MergeRequestsService`) will change,
 * not this function.
 */
export const DEFAULT_DIFFICULTY_THRESHOLDS: DifficultyThresholds = {
  easyFiles: 5,
  easyLines: 100,
  hardFiles: 20,
  hardLines: 800,
};

/**
 * Computes the review difficulty of a merge request (RG-G03, RG-006-01).
 * @param files number of changed files.
 * @param lines changed lines (additions + deletions).
 * @see RG-G03
 */
export function calculateDifficulty(
  files: number,
  lines: number,
  thresholds: DifficultyThresholds,
): Difficulty {
  if (files < thresholds.easyFiles && lines < thresholds.easyLines) {
    return 'easy';
  }
  if (files > thresholds.hardFiles || lines > thresholds.hardLines) {
    return 'hard';
  }
  return 'medium';
}
