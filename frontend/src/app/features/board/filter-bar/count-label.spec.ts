import { MergeRequestView } from '../../../models/merge-request.model';
import { countLabelParts } from './count-label';

function mr(overrides: Partial<MergeRequestView> = {}): MergeRequestView {
  return {
    id: 1,
    projectAlias: 'api',
    iid: 1,
    title: 'Title',
    webUrl: 'https://gitlab.com/equipe/api/-/merge_requests/1',
    draft: false,
    author: { username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
    reviewers: [],
    assignees: [],
    approved: false,
    commentsCount: 0,
    difficulty: 'easy',
    changedFiles: 1,
    additions: 1,
    deletions: 0,
    changedLines: 1,
    createdAt: '2026-09-01T10:00:00.000Z',
    readyAt: '2026-09-01T10:00:00.000Z',
    readyDays: 1,
    readyLevel: 'green',
    openedDays: 1,
    isMine: false,
    mergeStatus: { state: 'mergeable', reasons: [] },
    ...overrides,
  };
}

describe('countLabelParts', () => {
  it('should_report_zero_for_an_empty_list', () => {
    expect(countLabelParts([])).toEqual({
      count: 0,
      countSuffix: '',
      projects: 0,
      projectsSuffix: '',
    });
  });

  it('should_not_pluralize_a_single_mr_in_a_single_project', () => {
    expect(countLabelParts([mr()])).toEqual({
      count: 1,
      countSuffix: '',
      projects: 1,
      projectsSuffix: '',
    });
  });

  it('should_pluralize_several_mrs_and_count_distinct_projects', () => {
    const result = countLabelParts([
      mr({ id: 1, projectAlias: 'api' }),
      mr({ id: 2, projectAlias: 'api' }),
      mr({ id: 3, projectAlias: 'web' }),
    ]);

    expect(result).toEqual({
      count: 3,
      countSuffix: 's',
      projects: 2,
      projectsSuffix: 's',
    });
  });
});
