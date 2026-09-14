export interface FilterablePerson {
  username: string;
  name: string;
}

export interface FilterableConnection {
  name: string;
}

/** Structural subset of `MergeRequestViewDto` needed for RG-010 filtering/facets — no mapping needed at call sites. */
export interface FilterableMergeRequest {
  projectAlias: string;
  author: FilterablePerson;
  reviewers: FilterablePerson[];
  assignees: FilterablePerson[];
  approved: boolean;
  commentsCount: number;
  connection: FilterableConnection;
}

export type FilterKey =
  'connection' | 'project' | 'author' | 'assigned' | 'approved' | 'commented';

export interface ComposableFilters {
  /** Connection names (RG-021-03), matched case-insensitively (RG-021-05). */
  connection: string[];
  project: string[];
  author: string[];
  /** `'nobody'` is a plain value here, alongside usernames. */
  assigned: string[];
  approved: 'yes' | 'no' | null;
  commented: 'yes' | 'no' | null;
}

/** RG-010-02: an empty/`null` filter excludes nothing. */
export const EMPTY_COMPOSABLE_FILTERS: ComposableFilters = {
  connection: [],
  project: [],
  author: [],
  assigned: [],
  approved: null,
  commented: null,
};

/** RG-021-05: the only filter matched case-insensitively — connection names are user-chosen free text. */
function matchesConnection(
  mr: FilterableMergeRequest,
  filters: ComposableFilters,
): boolean {
  if (filters.connection.length === 0) {
    return true;
  }
  const name = mr.connection.name.toLowerCase();
  return filters.connection.some((value) => value.toLowerCase() === name);
}

function matchesProject(
  mr: FilterableMergeRequest,
  filters: ComposableFilters,
): boolean {
  return (
    filters.project.length === 0 || filters.project.includes(mr.projectAlias)
  );
}

function matchesAuthor(
  mr: FilterableMergeRequest,
  filters: ComposableFilters,
): boolean {
  return (
    filters.author.length === 0 || filters.author.includes(mr.author.username)
  );
}

/** RG-G13: OR between reviewer and assignee ; "nobody" means neither. */
function matchesAssigned(
  mr: FilterableMergeRequest,
  filters: ComposableFilters,
): boolean {
  if (filters.assigned.length === 0) {
    return true;
  }
  return filters.assigned.some((value) =>
    value === 'nobody'
      ? mr.reviewers.length === 0 && mr.assignees.length === 0
      : mr.reviewers.some((p) => p.username === value) ||
        mr.assignees.some((p) => p.username === value),
  );
}

function matchesApproved(
  mr: FilterableMergeRequest,
  filters: ComposableFilters,
): boolean {
  return (
    filters.approved === null || (filters.approved === 'yes') === mr.approved
  );
}

function matchesCommented(
  mr: FilterableMergeRequest,
  filters: ComposableFilters,
): boolean {
  return (
    filters.commented === null ||
    (filters.commented === 'yes') === mr.commentsCount > 0
  );
}

const TESTS: Record<
  FilterKey,
  (mr: FilterableMergeRequest, filters: ComposableFilters) => boolean
> = {
  connection: matchesConnection,
  project: matchesProject,
  author: matchesAuthor,
  assigned: matchesAssigned,
  approved: matchesApproved,
  commented: matchesCommented,
};

const ALL_KEYS: FilterKey[] = [
  'connection',
  'project',
  'author',
  'assigned',
  'approved',
  'commented',
];

/** RG-010-02: AND between filters, OR between values of the same filter. */
export function applyComposableFilters<T extends FilterableMergeRequest>(
  items: T[],
  filters: ComposableFilters,
): T[] {
  return items.filter((item) =>
    ALL_KEYS.every((key) => TESTS[key](item, filters)),
  );
}

/** RG-010-07: like `applyComposableFilters`, but ignores the `except` filter — used to compute its own facet counts. */
export function applyComposableFiltersExcept<T extends FilterableMergeRequest>(
  items: T[],
  filters: ComposableFilters,
  except: FilterKey,
): T[] {
  return items.filter((item) =>
    ALL_KEYS.filter((key) => key !== except).every((key) =>
      TESTS[key](item, filters),
    ),
  );
}
