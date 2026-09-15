import {
  DEFAULT_DIFFICULTY_THRESHOLDS,
  DIFFICULTY_ORDER,
  calculateDifficulty,
} from './calculate-difficulty.js';

describe('calculateDifficulty', () => {
  it.each([
    [1, 14, 'easy'],
    [4, 99, 'easy'],
    [5, 99, 'medium'],
    [4, 100, 'medium'],
    [9, 310, 'medium'],
    [20, 800, 'medium'],
    [21, 10, 'hard'],
    [2, 801, 'hard'],
    [34, 1240, 'hard'],
  ] as const)(
    'should_return_%s_for_%i_files_and_%i_lines',
    (files, lines, expected) => {
      expect(
        calculateDifficulty(files, lines, DEFAULT_DIFFICULTY_THRESHOLDS),
      ).toBe(expected);
    },
  );

  it('should_treat_the_easy_files_boundary_as_exclusive', () => {
    expect(
      calculateDifficulty(5, 0, {
        easyFiles: 5,
        easyLines: 100,
        hardFiles: 20,
        hardLines: 800,
      }),
    ).toBe('medium');
    expect(
      calculateDifficulty(4, 0, {
        easyFiles: 5,
        easyLines: 100,
        hardFiles: 20,
        hardLines: 800,
      }),
    ).toBe('easy');
  });

  it('should_treat_the_easy_lines_boundary_as_exclusive', () => {
    expect(
      calculateDifficulty(0, 100, {
        easyFiles: 5,
        easyLines: 100,
        hardFiles: 20,
        hardLines: 800,
      }),
    ).toBe('medium');
    expect(
      calculateDifficulty(0, 99, {
        easyFiles: 5,
        easyLines: 100,
        hardFiles: 20,
        hardLines: 800,
      }),
    ).toBe('easy');
  });

  it('should_treat_the_hard_files_boundary_as_exclusive', () => {
    expect(
      calculateDifficulty(20, 0, {
        easyFiles: 5,
        easyLines: 100,
        hardFiles: 20,
        hardLines: 800,
      }),
    ).toBe('medium');
    expect(
      calculateDifficulty(21, 0, {
        easyFiles: 5,
        easyLines: 100,
        hardFiles: 20,
        hardLines: 800,
      }),
    ).toBe('hard');
  });

  it('should_treat_the_hard_lines_boundary_as_exclusive', () => {
    expect(
      calculateDifficulty(0, 800, {
        easyFiles: 5,
        easyLines: 100,
        hardFiles: 20,
        hardLines: 800,
      }),
    ).toBe('medium');
    expect(
      calculateDifficulty(0, 801, {
        easyFiles: 5,
        easyLines: 100,
        hardFiles: 20,
        hardLines: 800,
      }),
    ).toBe('hard');
  });

  it('should_expose_the_rg_g03_default_thresholds', () => {
    expect(DEFAULT_DIFFICULTY_THRESHOLDS).toEqual({
      easyFiles: 5,
      easyLines: 100,
      hardFiles: 20,
      hardLines: 800,
    });
  });
});

describe('DIFFICULTY_ORDER', () => {
  it('should_rank_easy_below_medium_below_hard', () => {
    expect(DIFFICULTY_ORDER.easy).toBeLessThan(DIFFICULTY_ORDER.medium);
    expect(DIFFICULTY_ORDER.medium).toBeLessThan(DIFFICULTY_ORDER.hard);
  });
});
