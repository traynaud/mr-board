import { DIFFICULTY_ORDER, Difficulty } from './calculate-difficulty.js';

export type SortKey = 'ready' | 'diff';
export type SortDirection = 'asc' | 'desc';
export type SortParam = 'ready:asc' | 'ready:desc' | 'diff:asc' | 'diff:desc';

export const SORT_PARAMS: readonly SortParam[] = [
  'ready:asc',
  'ready:desc',
  'diff:asc',
  'diff:desc',
];

/** RG-008-01. */
export const DEFAULT_SORT: SortParam = 'ready:asc';

export interface SortableMergeRequest {
  iid: number;
  draft: boolean;
  /** `null` for a draft (RG-004-04 invariant) ; ignored when `draft` is `true`. */
  readyAt: string | null;
  createdAt: string;
  difficulty: Difficulty;
}

/**
 * Orders merge requests per RG-G10/RG-008-01/04/05: the Ready block sorted
 * by `sort`, always before the Draft block — itself always sorted by
 * `createdAt` ascending, regardless of `sort`'s direction.
 * @see RG-008-04
 * @see RG-008-05
 */
export function sortMergeRequests<T extends SortableMergeRequest>(
  items: T[],
  sort: SortParam,
): T[] {
  const [key, direction] = sort.split(':') as [SortKey, SortDirection];
  const dirMul = direction === 'asc' ? 1 : -1;

  const ready = items.filter(
    (item): item is T & { readyAt: string } =>
      !item.draft && item.readyAt !== null,
  );
  const drafts = items.filter((item) => item.draft);

  ready.sort((a, b) => compareReady(a, b, key) * dirMul);
  drafts.sort(
    (a, b) =>
      Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.iid - b.iid,
  );

  return [...ready, ...drafts];
}

function compareReady(
  a: SortableMergeRequest & { readyAt: string },
  b: SortableMergeRequest & { readyAt: string },
  key: SortKey,
): number {
  const byReady = Date.parse(a.readyAt) - Date.parse(b.readyAt);
  const byDifficulty =
    DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty];
  const primary = key === 'ready' ? byReady : byDifficulty;
  const secondary = key === 'ready' ? byDifficulty : byReady;
  return primary || secondary || a.iid - b.iid;
}
