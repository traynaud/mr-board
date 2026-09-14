import { projectTagStyle } from './project-tag-style';

describe('projectTagStyle', () => {
  it('should_return_null_when_the_repo_has_no_color_rg_025_01', () => {
    expect(projectTagStyle(null, false)).toBeNull();
    expect(projectTagStyle(undefined, true)).toBeNull();
  });

  it('should_return_null_for_an_unknown_color_id', () => {
    expect(projectTagStyle('not-a-real-color', false)).toBeNull();
  });

  it('should_return_the_full_color_for_a_ready_mr_rg_025_03', () => {
    expect(projectTagStyle('sage', false)).toEqual({
      background: '#c8ddc7',
      color: '#25381f',
    });
  });

  it('should_lighten_the_background_to_45_percent_for_a_draft_mr_rg_025_04', () => {
    expect(projectTagStyle('sage', true)).toEqual({
      background: 'rgba(200, 221, 199, 0.45)',
      color: '#25381f',
    });
  });

  it('should_keep_the_same_text_color_between_ready_and_draft_rg_025_04', () => {
    const ready = projectTagStyle('peach', false);
    const draft = projectTagStyle('peach', true);
    expect(ready?.color).toBe(draft?.color);
  });
});
