import { isIgnoredByLabel } from './is-ignored-by-label';

describe('isIgnoredByLabel', () => {
  it('should_return_false_when_no_label_is_ignored', () => {
    expect(isIgnoredByLabel(JSON.stringify(['wip']), [])).toBe(false);
  });

  it('should_return_false_when_the_merge_request_carries_no_ignored_label', () => {
    expect(
      isIgnoredByLabel(JSON.stringify(['backend', 'urgent']), [
        'wip',
        'on-hold',
      ]),
    ).toBe(false);
  });

  it('should_return_true_when_one_label_matches', () => {
    expect(
      isIgnoredByLabel(JSON.stringify(['backend', 'wip']), ['wip', 'on-hold']),
    ).toBe(true);
  });

  it('should_compare_case_insensitively', () => {
    expect(isIgnoredByLabel(JSON.stringify(['WIP']), ['wip'])).toBe(true);
    expect(isIgnoredByLabel(JSON.stringify(['wip']), ['WIP'])).toBe(true);
  });

  it('should_return_false_when_the_merge_request_has_no_labels', () => {
    expect(isIgnoredByLabel(JSON.stringify([]), ['wip'])).toBe(false);
  });
});
