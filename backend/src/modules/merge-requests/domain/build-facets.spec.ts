import {
  ComposableFilters,
  EMPTY_COMPOSABLE_FILTERS,
  FilterableMergeRequest,
} from './filter-merge-requests';
import { ConfiguredProject, buildFacets } from './build-facets';

function person(
  username: string,
  name = username,
): { username: string; name: string } {
  return { username, name };
}

function mr(
  overrides: Partial<FilterableMergeRequest> = {},
): FilterableMergeRequest {
  return {
    projectAlias: 'api',
    author: person('mdupont', 'Marie Dupont'),
    reviewers: [],
    assignees: [],
    approved: false,
    commentsCount: 0,
    ...overrides,
  };
}

function filters(
  overrides: Partial<ComposableFilters> = {},
): ComposableFilters {
  return { ...EMPTY_COMPOSABLE_FILTERS, ...overrides };
}

const REPOS: ConfiguredProject[] = [
  { alias: 'web', pathWithNamespace: 'equipe/front-web' },
  { alias: 'api', pathWithNamespace: 'equipe/backend-api' },
];

describe('buildFacets', () => {
  it('should_list_every_configured_project_sorted_by_alias_even_with_zero_count', () => {
    const facets = buildFacets([mr({ projectAlias: 'api' })], filters(), REPOS);

    expect(facets.project).toEqual([
      { value: 'api', label: 'api · equipe/backend-api', count: 1 },
      { value: 'web', label: 'web · equipe/front-web', count: 0 },
    ]);
  });

  it('should_only_list_authors_present_in_the_base_set_sorted_by_name', () => {
    const facets = buildFacets(
      [
        mr({ author: person('kbenali', 'Karim Benali') }),
        mr({ author: person('mdupont', 'Marie Dupont') }),
      ],
      filters(),
      REPOS,
    );

    expect(facets.author).toEqual([
      { value: 'kbenali', label: 'Karim Benali', count: 1 },
      { value: 'mdupont', label: 'Marie Dupont', count: 1 },
    ]);
  });

  it('should_count_each_merge_request_once_per_author_even_with_several', () => {
    const facets = buildFacets(
      [
        mr({ author: person('mdupont', 'Marie Dupont') }),
        mr({ author: person('mdupont', 'Marie Dupont') }),
      ],
      filters(),
      REPOS,
    );

    expect(facets.author).toEqual([
      { value: 'mdupont', label: 'Marie Dupont', count: 2 },
    ]);
  });

  it('should_always_list_nobody_first_in_assigned', () => {
    const facets = buildFacets(
      [mr({ reviewers: [person('zaccary', 'Zaccary Aaa')] })],
      filters(),
      REPOS,
    );

    expect(facets.assigned[0]).toEqual({
      value: 'nobody',
      label: 'Nobody',
      count: 0,
    });
    expect(facets.assigned[1]).toEqual({
      value: 'zaccary',
      label: 'Zaccary Aaa',
      count: 1,
    });
  });

  it('should_deduplicate_a_user_appearing_as_both_reviewer_and_assignee_across_merge_requests', () => {
    const facets = buildFacets(
      [
        mr({ reviewers: [person('mdupont', 'Marie Dupont')] }),
        mr({ assignees: [person('mdupont', 'Marie Dupont')] }),
      ],
      filters(),
      REPOS,
    );

    expect(facets.assigned).toHaveLength(2); // nobody + mdupont
    expect(facets.assigned[1]).toEqual({
      value: 'mdupont',
      label: 'Marie Dupont',
      count: 2,
    });
  });

  it('should_report_approved_and_commented_as_two_option_facets', () => {
    const facets = buildFacets(
      [
        mr({ approved: true, commentsCount: 2 }),
        mr({ approved: false, commentsCount: 0 }),
      ],
      filters(),
      REPOS,
    );

    expect(facets.approved).toEqual([
      { value: 'yes', label: 'Oui', count: 1 },
      { value: 'no', label: 'Non', count: 1 },
    ]);
    expect(facets.commented).toEqual([
      { value: 'yes', label: 'Oui', count: 1 },
      { value: 'no', label: 'Non', count: 1 },
    ]);
  });

  it('should_ignore_a_filter_own_active_value_when_computing_its_own_counts_but_apply_it_to_others', () => {
    // RG-010-07 example: "Projet : api" active, 5 MRs from api with 2 having
    // no reviewer/assignee. Opening "Affecté à" must show Nobody = 2 (project
    // filter still applied there), while "Projet"'s own counts ignore the
    // project filter itself.
    const base = [
      mr({ projectAlias: 'api', reviewers: [], assignees: [] }),
      mr({ projectAlias: 'api', reviewers: [], assignees: [] }),
      mr({ projectAlias: 'api', reviewers: [person('mdupont')] }),
      mr({ projectAlias: 'web', reviewers: [], assignees: [] }),
    ];

    const facets = buildFacets(base, filters({ project: ['api'] }), REPOS);

    const nobody = facets.assigned.find((o) => o.value === 'nobody');
    expect(nobody?.count).toBe(2);

    const apiOption = facets.project.find((o) => o.value === 'api');
    const webOption = facets.project.find((o) => o.value === 'web');
    expect(apiOption?.count).toBe(3);
    expect(webOption?.count).toBe(1);
  });

  it('should_return_empty_option_lists_and_zero_counts_for_an_empty_base', () => {
    const facets = buildFacets([], filters(), []);

    expect(facets.project).toEqual([]);
    expect(facets.author).toEqual([]);
    expect(facets.assigned).toEqual([
      { value: 'nobody', label: 'Nobody', count: 0 },
    ]);
    expect(facets.approved).toEqual([
      { value: 'yes', label: 'Oui', count: 0 },
      { value: 'no', label: 'Non', count: 0 },
    ]);
  });
});
