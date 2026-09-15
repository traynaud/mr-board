import { PROJECT_COLOR_IDS } from './project-color.js';

describe('PROJECT_COLOR_IDS', () => {
  it('should_expose_exactly_ten_colors_rg_025_02', () => {
    expect(PROJECT_COLOR_IDS).toHaveLength(10);
  });

  it('should_not_contain_duplicate_ids', () => {
    expect(new Set(PROJECT_COLOR_IDS).size).toBe(PROJECT_COLOR_IDS.length);
  });
});
