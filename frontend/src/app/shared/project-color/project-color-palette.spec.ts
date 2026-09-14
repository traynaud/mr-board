import { PROJECT_COLOR_PALETTE, findProjectColor } from './project-color-palette';

describe('PROJECT_COLOR_PALETTE', () => {
  it('should_expose_exactly_ten_colors_rg_025_02', () => {
    expect(PROJECT_COLOR_PALETTE).toHaveLength(10);
  });

  it('should_not_contain_duplicate_ids', () => {
    const ids = PROJECT_COLOR_PALETTE.map((swatch) => swatch.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('findProjectColor', () => {
  it('should_return_null_for_null_rg_025_01', () => {
    expect(findProjectColor(null)).toBeNull();
  });

  it('should_return_null_for_undefined', () => {
    expect(findProjectColor(undefined)).toBeNull();
  });

  it('should_return_null_for_an_unknown_id', () => {
    expect(findProjectColor('not-a-real-color')).toBeNull();
  });

  it('should_return_the_matching_swatch', () => {
    expect(findProjectColor('sage')).toEqual(
      expect.objectContaining({ id: 'sage', background: '#c8ddc7', text: '#25381f' }),
    );
  });
});
