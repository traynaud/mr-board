export interface SearchableMergeRequest {
  title: string;
  iid: number;
}

/** Matches a `!42`/`#42`/`42` query (RG-026-05) — digits only, optional `!`/`#` prefix. */
const IID_QUERY_PATTERN = /^[!#]?(\d+)$/;

/** Range of Unicode combining diacritical marks left behind by NFD decomposition. */
const COMBINING_DIACRITICS_PATTERN = /[̀-ͯ]/g;

/** A query normalized once (RG-026-*), reused across every merge request of a list. */
export interface CompiledSearch {
  /** Normalized, non-empty terms (RG-026-03/04/08) — empty means "no search". */
  terms: string[];
  /** Parsed `iid` for a `!42`/`#42`/`42` query, `null` otherwise (RG-026-05). */
  iidQuery: number | null;
}

/** Strips diacritics after Unicode NFD decomposition and lowercases (RG-026-04). */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS_PATTERN, '')
    .toLowerCase();
}

/**
 * Splits a search query into normalized terms (RG-026-03/04/08): trims,
 * collapses whitespace, drops accents/case. An empty/blank query yields no
 * terms.
 */
function splitTerms(query: string): string[] {
  return normalize(query).trim().split(/\s+/).filter(Boolean);
}

/**
 * Normalizes `query` once — terms and `iid` alike — so a list of merge
 * requests can be matched against it without redoing this work per item
 * (see `matchesCompiledSearch`).
 */
export function compileSearch(query: string): CompiledSearch {
  const iidMatch = IID_QUERY_PATTERN.exec(query.trim());
  return {
    terms: splitTerms(query),
    iidQuery: iidMatch ? Number(iidMatch[1]) : null,
  };
}

/**
 * Whether `mr` matches an already-`compileSearch`-ed query (RG-026-*): every
 * term must appear in the title (AND, order-independent, accent/case
 * insensitive substring match) — OR'd with an exact `iid` equality when the
 * query was a `!42`/`#42`/`42` number (RG-026-05). No terms and no `iid`
 * query (blank input) matches everything (RG-026-08).
 */
export function matchesCompiledSearch(
  mr: SearchableMergeRequest,
  compiled: CompiledSearch,
): boolean {
  const titleMatches =
    compiled.terms.length === 0 ||
    (() => {
      const title = normalize(mr.title);
      return compiled.terms.every((term) => title.includes(term));
    })();
  const iidMatches = compiled.iidQuery !== null && mr.iid === compiled.iidQuery;
  return titleMatches || iidMatches;
}

/** Convenience one-shot form of `matchesCompiledSearch` — compiles `query` on every call. */
export function matchesSearch(
  mr: SearchableMergeRequest,
  query: string,
): boolean {
  return matchesCompiledSearch(mr, compileSearch(query));
}

/** Filters `items` by `query` — returns `items` unchanged for a blank `query` (RG-026-08). */
export function searchMergeRequests<T extends SearchableMergeRequest>(
  items: T[],
  query: string,
): T[] {
  if (query.trim() === '') {
    return items;
  }
  const compiled = compileSearch(query);
  return items.filter((item) => matchesCompiledSearch(item, compiled));
}
