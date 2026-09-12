import {
  ComposableFilters,
  EMPTY_COMPOSABLE_FILTERS,
  FilterableMergeRequest,
  applyComposableFilters,
  applyComposableFiltersExcept,
} from './filter-merge-requests';

function person(
  username: string,
  name = username,
): { username: string; name: string } {
  return { username, name };
}

function mr(
  overrides: Partial<FilterableMergeRequest> & { id: number },
): FilterableMergeRequest & { id: number } {
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

describe('applyComposableFilters', () => {
  it('should_exclude_nothing_when_all_filters_are_empty', () => {
    const items = [mr({ id: 1 }), mr({ id: 2, projectAlias: 'web' })];

    expect(applyComposableFilters(items, filters()).map((m) => m.id)).toEqual([
      1, 2,
    ]);
  });

  it('should_filter_by_project_or_between_values', () => {
    const items = [
      mr({ id: 1, projectAlias: 'api' }),
      mr({ id: 2, projectAlias: 'web' }),
      mr({ id: 3, projectAlias: 'infra' }),
    ];

    expect(
      applyComposableFilters(items, filters({ project: ['api', 'web'] })).map(
        (m) => m.id,
      ),
    ).toEqual([1, 2]);
  });

  it('should_filter_by_author', () => {
    const items = [
      mr({ id: 1, author: person('mdupont') }),
      mr({ id: 2, author: person('kbenali') }),
    ];

    expect(
      applyComposableFilters(items, filters({ author: ['kbenali'] })).map(
        (m) => m.id,
      ),
    ).toEqual([2]);
  });

  it('should_filter_assigned_as_or_between_reviewer_and_assignee', () => {
    const reviewerOnly = mr({
      id: 1,
      reviewers: [person('kbenali')],
      assignees: [],
    });
    const assigneeOnly = mr({
      id: 2,
      reviewers: [],
      assignees: [person('kbenali')],
    });
    const neither = mr({ id: 3, reviewers: [], assignees: [] });

    const result = applyComposableFilters(
      [reviewerOnly, assigneeOnly, neither],
      filters({ assigned: ['kbenali'] }),
    ).map((m) => m.id);

    expect(result).toEqual([1, 2]);
  });

  it('should_treat_nobody_as_no_reviewer_and_no_assignee', () => {
    const withRole = mr({ id: 1, reviewers: [person('mdupont')] });
    const withoutRole = mr({ id: 2, reviewers: [], assignees: [] });

    expect(
      applyComposableFilters(
        [withRole, withoutRole],
        filters({ assigned: ['nobody'] }),
      ).map((m) => m.id),
    ).toEqual([2]);
  });

  it('should_combine_nobody_and_a_username_as_or', () => {
    const nobody = mr({ id: 1, reviewers: [], assignees: [] });
    const mdupont = mr({ id: 2, assignees: [person('mdupont')] });
    const other = mr({ id: 3, assignees: [person('kbenali')] });

    expect(
      applyComposableFilters(
        [nobody, mdupont, other],
        filters({ assigned: ['nobody', 'mdupont'] }),
      ).map((m) => m.id),
    ).toEqual([1, 2]);
  });

  it('should_filter_by_approved', () => {
    const items = [
      mr({ id: 1, approved: true }),
      mr({ id: 2, approved: false }),
    ];

    expect(
      applyComposableFilters(items, filters({ approved: 'no' })).map(
        (m) => m.id,
      ),
    ).toEqual([2]);
  });

  it('should_filter_by_commented', () => {
    const items = [
      mr({ id: 1, commentsCount: 3 }),
      mr({ id: 2, commentsCount: 0 }),
    ];

    expect(
      applyComposableFilters(items, filters({ commented: 'yes' })).map(
        (m) => m.id,
      ),
    ).toEqual([1]);
  });

  it('should_combine_filters_with_and', () => {
    const items = [
      mr({ id: 1, projectAlias: 'api', approved: true }),
      mr({ id: 2, projectAlias: 'api', approved: false }),
      mr({ id: 3, projectAlias: 'web', approved: true }),
    ];

    expect(
      applyComposableFilters(
        items,
        filters({ project: ['api'], approved: 'yes' }),
      ).map((m) => m.id),
    ).toEqual([1]);
  });

  it('should_exclude_everything_for_an_unknown_value_rg_010_12', () => {
    const items = [mr({ id: 1 })];

    expect(
      applyComposableFilters(items, filters({ project: ['inconnu'] })),
    ).toEqual([]);
  });
});

describe('applyComposableFiltersExcept', () => {
  it('should_ignore_the_given_filter_but_apply_the_others', () => {
    const items = [
      mr({ id: 1, projectAlias: 'api', approved: true }),
      mr({ id: 2, projectAlias: 'web', approved: true }),
      mr({ id: 3, projectAlias: 'api', approved: false }),
    ];

    const result = applyComposableFiltersExcept(
      items,
      filters({ project: ['api'], approved: 'yes' }),
      'project',
    ).map((m) => m.id);

    // "project" is ignored, "approved: yes" still applies.
    expect(result).toEqual([1, 2]);
  });

  it('should_apply_every_filter_when_none_are_active', () => {
    const items = [mr({ id: 1 }), mr({ id: 2 })];

    expect(
      applyComposableFiltersExcept(items, filters(), 'approved').map(
        (m) => m.id,
      ),
    ).toEqual([1, 2]);
  });
});
