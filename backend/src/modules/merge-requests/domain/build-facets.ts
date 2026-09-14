import {
  ComposableFilters,
  FilterKey,
  FilterableMergeRequest,
  applyComposableFiltersExcept,
} from './filter-merge-requests';

export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

export interface MergeRequestsFacets {
  /** RG-021-03: every configured connection, even with zero count (same pattern as `project`). */
  connection: FacetOption[];
  project: FacetOption[];
  author: FacetOption[];
  /** `'nobody'` is always the first entry (RG-010-05). */
  assigned: FacetOption[];
  /** Two entries, `'yes'`/`'no'` (RG-010-01, see archi.md for the chosen shape). */
  approved: FacetOption[];
  commented: FacetOption[];
  /** `'none'` ("Sans label") is always the first entry (RG-028-13). */
  label: FacetOption[];
}

export interface ConfiguredProject {
  alias: string;
  pathWithNamespace: string;
}

export interface ConfiguredConnection {
  name: string;
}

/**
 * RG-010-07/08: for each filter, options and their count are computed
 * against `base` with every *other* active composable filter applied —
 * never the filter itself.
 * @see RG-010-07
 */
export function buildFacets(
  base: FilterableMergeRequest[],
  filters: ComposableFilters,
  configuredProjects: ConfiguredProject[],
  configuredConnections: ConfiguredConnection[],
): MergeRequestsFacets {
  const countFor = (
    key: FilterKey,
    predicate: (mr: FilterableMergeRequest) => boolean,
  ): number =>
    applyComposableFiltersExcept(base, filters, key).filter(predicate).length;

  const connection: FacetOption[] = [...configuredConnections]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((conn) => ({
      value: conn.name,
      label: conn.name,
      count: countFor(
        'connection',
        (mr) => mr.connection.name.toLowerCase() === conn.name.toLowerCase(),
      ),
    }));

  const project: FacetOption[] = [...configuredProjects]
    .sort((a, b) => a.alias.localeCompare(b.alias))
    .map((repo) => ({
      value: repo.alias,
      label: `${repo.alias} · ${repo.pathWithNamespace}`,
      count: countFor('project', (mr) => mr.projectAlias === repo.alias),
    }));

  const authors = uniquePeople(base.map((mr) => mr.author));
  const author: FacetOption[] = authors
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((user) => ({
      value: user.username,
      label: user.name,
      count: countFor('author', (mr) => mr.author.username === user.username),
    }));

  const assignedUsers = uniquePeople(
    base.flatMap((mr) => [...mr.reviewers, ...mr.assignees]),
  );
  const assigned: FacetOption[] = [
    {
      value: 'nobody',
      label: 'Nobody',
      count: countFor(
        'assigned',
        (mr) => mr.reviewers.length === 0 && mr.assignees.length === 0,
      ),
    },
    ...assignedUsers
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((user) => ({
        value: user.username,
        label: user.name,
        count: countFor(
          'assigned',
          (mr) =>
            mr.reviewers.some((p) => p.username === user.username) ||
            mr.assignees.some((p) => p.username === user.username),
        ),
      })),
  ];

  const approved: FacetOption[] = [
    {
      value: 'yes',
      label: 'Oui',
      count: countFor('approved', (mr) => mr.approved),
    },
    {
      value: 'no',
      label: 'Non',
      count: countFor('approved', (mr) => !mr.approved),
    },
  ];
  const commented: FacetOption[] = [
    {
      value: 'yes',
      label: 'Oui',
      count: countFor('commented', (mr) => mr.commentsCount > 0),
    },
    {
      value: 'no',
      label: 'Non',
      count: countFor('commented', (mr) => mr.commentsCount === 0),
    },
  ];

  const label = buildLabelFacet(base, countFor);

  return { connection, project, author, assigned, approved, commented, label };
}

/**
 * RG-028-12/13/14: distinct labels across `base` (exact, case-sensitive
 * values — RG-028-14), sorted alphabetically ignoring case and accents.
 * `'none'` ("Sans label") is always first. A label containing a comma can't
 * be represented in the URL (`label=<csv>`, RG-028-15) and is excluded from
 * the options — it stays visible in the column, just not filterable.
 */
function buildLabelFacet(
  base: FilterableMergeRequest[],
  countFor: (
    key: FilterKey,
    predicate: (mr: FilterableMergeRequest) => boolean,
  ) => number,
): FacetOption[] {
  const distinctLabels = [...new Set(base.flatMap((mr) => mr.labels))].filter(
    (value) => !value.includes(','),
  );
  const labelOptions = distinctLabels
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .map((value) => ({
      value,
      label: value,
      count: countFor('label', (mr) => mr.labels.includes(value)),
    }));
  return [
    {
      value: 'none',
      label: 'Sans label',
      count: countFor('label', (mr) => mr.labels.length === 0),
    },
    ...labelOptions,
  ];
}

function uniquePeople<T extends { username: string }>(people: T[]): T[] {
  const byUsername = new Map<string, T>();
  for (const person of people) {
    if (!byUsername.has(person.username)) {
      byUsername.set(person.username, person);
    }
  }
  return [...byUsername.values()];
}
