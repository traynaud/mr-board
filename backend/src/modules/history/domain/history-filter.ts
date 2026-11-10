import { BusinessValidationException } from '../../../common/exceptions/index.js';
import { compileSearch } from '../../merge-requests/domain/search-merge-requests.js';
import type { HistoryEventType } from '../entities/merge-request-event.entity.js';

/** Name of the SQL function folding case and accents, registered at connection time (RG-038-05). */
export const SQL_FOLD_FUNCTION = 'mrb_fold';

/** Reserved `actor` value selecting events without an identified actor (RG-038-07). */
export const UNKNOWN_ACTOR = 'none';

/** Raw filter inputs of the timeline, as validated by `HistoryQueryDto`. */
export interface HistoryFilterInput {
  q?: string;
  type?: HistoryEventType[];
  actor?: string[];
  project?: number[];
  from?: string;
  to?: string;
}

/** Normalised filter of the timeline (RG-038-*), ready to be translated to SQL. */
export interface HistoryFilter {
  /** Normalised search terms (all required, RG-038-05); empty = no title search. */
  terms: string[];
  /** Exact `mr_iid` also accepted for a `!42` / `#42` / `42` search (RG-026-05). */
  iid: number | null;
  types: HistoryEventType[];
  /** Usernames to retain, `none` excluded. */
  actors: string[];
  /** Whether events without actor are retained (`none` selected). */
  includeUnknownActor: boolean;
  projectIds: number[];
  /** ISO instant, inclusive. */
  from: string | null;
  /** ISO instant, exclusive. */
  to: string | null;
}

/**
 * Builds the normalised filter from the query inputs (RG-038-02/05/09).
 * @throws BusinessValidationException `history.filter.period.invalid` when `from` is after `to`.
 */
export function buildHistoryFilter(input: HistoryFilterInput): HistoryFilter {
  const search = compileSearch(input.q ?? '');
  const from = input.from ? new Date(input.from).toISOString() : null;
  const to = input.to ? new Date(input.to).toISOString() : null;
  if (from !== null && to !== null && from > to) {
    throw new BusinessValidationException(
      'history.filter.period.invalid',
      'The start of the period is after its end',
    );
  }
  const actors = input.actor ?? [];
  return {
    terms: search.terms,
    iid: search.iidQuery,
    types: input.type ?? [],
    actors: actors.filter((actor) => actor !== UNKNOWN_ACTOR),
    includeUnknownActor: actors.includes(UNKNOWN_ACTOR),
    projectIds: input.project ?? [],
    from,
    to,
  };
}

/** Escapes `%`, `_` and `\` so a search term is matched literally by `LIKE … ESCAPE '\'`. */
export function toLikePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
