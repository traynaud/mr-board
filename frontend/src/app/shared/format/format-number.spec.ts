import { formatThousands } from './format-number';

describe('formatThousands', () => {
  it('should_not_add_a_separator_below_one_thousand', () => {
    expect(formatThousands(340)).toBe('340');
    expect(formatThousands(0)).toBe('0');
  });

  it('should_add_a_space_separator_at_the_thousands', () => {
    expect(formatThousands(1240)).toBe('1 240');
  });

  it('should_add_a_separator_for_every_group_of_three_digits', () => {
    expect(formatThousands(1234567)).toBe('1 234 567');
  });

  it('should_keep_the_sign_of_a_negative_number', () => {
    expect(formatThousands(-1240)).toBe('-1 240');
  });
});
