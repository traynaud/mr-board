import { computeInitials } from './compute-initials';

describe('computeInitials', () => {
  it.each([
    ['Marie Dupont', 'MD'],
    ['Ana', 'A'],
    ['Léa Rousseau', 'LR'],
    ['marie.dupont', 'MD'],
    ['jean-paul', 'JP'],
    ['mdupont', 'M'],
    ['l_rousseau', 'LR'],
    ['  marie   dupont  ', 'MD'],
  ])('should_compute_initials_of_%s_as_%s', (source, expected) => {
    expect(computeInitials(source)).toBe(expected);
  });

  it.each(['', '   ', '...', '--__'])(
    'should_return_placeholder_for_empty_or_separators_only_input (%j)',
    (source) => {
      expect(computeInitials(source)).toBe('?');
    },
  );
});
