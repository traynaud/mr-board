import {
  SortableMergeRequest,
  sortMergeRequests,
} from './sort-merge-requests.js';

function mr(
  overrides: Partial<SortableMergeRequest> & { iid: number },
): SortableMergeRequest {
  return {
    draft: false,
    readyAt: '2026-09-01T00:00:00.000Z',
    createdAt: '2026-09-01T00:00:00.000Z',
    difficulty: 'medium',
    ...overrides,
  };
}

describe('sortMergeRequests', () => {
  it('should_sort_the_ready_block_by_ready_at_ascending_by_default', () => {
    const items = [
      mr({ iid: 1, readyAt: '2026-09-05T00:00:00.000Z' }),
      mr({ iid: 2, readyAt: '2026-09-01T00:00:00.000Z' }),
      mr({ iid: 3, readyAt: '2026-09-08T00:00:00.000Z' }),
      mr({ iid: 4, readyAt: '2026-09-03T00:00:00.000Z' }),
    ];

    expect(sortMergeRequests(items, 'ready:asc').map((i) => i.iid)).toEqual([
      2, 4, 1, 3,
    ]);
  });

  it('should_reverse_the_whole_ready_order_for_ready_desc', () => {
    const items = [
      mr({ iid: 1, readyAt: '2026-09-05T00:00:00.000Z' }),
      mr({ iid: 2, readyAt: '2026-09-01T00:00:00.000Z' }),
      mr({ iid: 3, readyAt: '2026-09-08T00:00:00.000Z' }),
    ];

    expect(sortMergeRequests(items, 'ready:desc').map((i) => i.iid)).toEqual([
      3, 1, 2,
    ]);
  });

  it('should_sort_by_difficulty_then_ready_at_for_diff_asc', () => {
    const items = [
      mr({ iid: 1, difficulty: 'hard', readyAt: '2026-09-01T00:00:00.000Z' }),
      mr({ iid: 2, difficulty: 'easy', readyAt: '2026-09-05T00:00:00.000Z' }),
      mr({
        iid: 3,
        difficulty: 'easy',
        readyAt: '2026-09-01T00:00:00.000Z',
      }),
      mr({
        iid: 4,
        difficulty: 'medium',
        readyAt: '2026-09-01T00:00:00.000Z',
      }),
    ];

    // easy(iid 3, oldest) < easy(iid 2) < medium(iid 4) < hard(iid 1)
    expect(sortMergeRequests(items, 'diff:asc').map((i) => i.iid)).toEqual([
      3, 2, 4, 1,
    ]);
  });

  it('should_reverse_the_whole_order_including_tie_breaks_for_diff_desc', () => {
    const items = [
      mr({ iid: 1, difficulty: 'easy', readyAt: '2026-09-01T00:00:00.000Z' }),
      mr({ iid: 2, difficulty: 'hard', readyAt: '2026-09-01T00:00:00.000Z' }),
      mr({ iid: 3, difficulty: 'medium', readyAt: '2026-09-01T00:00:00.000Z' }),
    ];

    expect(sortMergeRequests(items, 'diff:desc').map((i) => i.iid)).toEqual([
      2, 3, 1,
    ]);
  });

  it('should_break_a_full_tie_on_iid_ascending', () => {
    const items = [
      mr({ iid: 9, readyAt: '2026-09-01T00:00:00.000Z', difficulty: 'easy' }),
      mr({ iid: 2, readyAt: '2026-09-01T00:00:00.000Z', difficulty: 'easy' }),
      mr({ iid: 5, readyAt: '2026-09-01T00:00:00.000Z', difficulty: 'easy' }),
    ];

    expect(sortMergeRequests(items, 'ready:asc').map((i) => i.iid)).toEqual([
      2, 5, 9,
    ]);
  });

  it('should_reverse_the_iid_tie_break_too_when_the_direction_is_desc', () => {
    const items = [
      mr({ iid: 2, readyAt: '2026-09-01T00:00:00.000Z', difficulty: 'easy' }),
      mr({ iid: 9, readyAt: '2026-09-01T00:00:00.000Z', difficulty: 'easy' }),
      mr({ iid: 5, readyAt: '2026-09-01T00:00:00.000Z', difficulty: 'easy' }),
    ];

    expect(sortMergeRequests(items, 'ready:desc').map((i) => i.iid)).toEqual([
      9, 5, 2,
    ]);
  });

  it('should_always_place_the_draft_block_after_the_ready_block_sorted_by_created_at_ascending', () => {
    const items = [
      mr({
        iid: 1,
        draft: true,
        readyAt: null,
        createdAt: '2026-09-05T00:00:00.000Z',
      }),
      mr({ iid: 2, readyAt: '2026-09-08T00:00:00.000Z' }),
      mr({
        iid: 3,
        draft: true,
        readyAt: null,
        createdAt: '2026-09-01T00:00:00.000Z',
      }),
    ];

    expect(sortMergeRequests(items, 'ready:desc').map((i) => i.iid)).toEqual([
      2, 3, 1,
    ]);
  });

  it('should_break_a_draft_tie_on_created_at_by_iid_ascending_regardless_of_direction', () => {
    const items = [
      mr({
        iid: 9,
        draft: true,
        readyAt: null,
        createdAt: '2026-09-01T00:00:00.000Z',
      }),
      mr({
        iid: 2,
        draft: true,
        readyAt: null,
        createdAt: '2026-09-01T00:00:00.000Z',
      }),
    ];

    expect(sortMergeRequests(items, 'diff:desc').map((i) => i.iid)).toEqual([
      2, 9,
    ]);
  });

  it('should_return_an_empty_array_when_there_is_nothing_to_sort', () => {
    expect(sortMergeRequests([], 'ready:asc')).toEqual([]);
  });

  it('should_sort_a_ready_only_list_without_error', () => {
    const items = [
      mr({ iid: 1 }),
      mr({ iid: 2, readyAt: '2026-08-01T00:00:00.000Z' }),
    ];

    expect(sortMergeRequests(items, 'ready:asc').map((i) => i.iid)).toEqual([
      2, 1,
    ]);
  });

  it('should_sort_a_draft_only_list_by_created_at_regardless_of_sort_param', () => {
    const items = [
      mr({
        iid: 1,
        draft: true,
        readyAt: null,
        createdAt: '2026-09-05T00:00:00.000Z',
      }),
      mr({
        iid: 2,
        draft: true,
        readyAt: null,
        createdAt: '2026-09-01T00:00:00.000Z',
      }),
    ];

    expect(sortMergeRequests(items, 'diff:asc').map((i) => i.iid)).toEqual([
      2, 1,
    ]);
  });
});
