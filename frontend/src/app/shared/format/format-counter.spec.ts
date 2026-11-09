import { COUNTER_CAP, formatCounter } from './format-counter';

describe('formatCounter (RG-040-03)', () => {
  it.each([
    [0, '0'],
    [7, '7'],
    [99, '99'],
    [100, '99+'],
    [12_345, '99+'],
  ])('should_format_%i_as_%s', (count, expected) => {
    expect(formatCounter(count)).toBe(expected);
  });

  it('should_cap_at_99', () => {
    expect(COUNTER_CAP).toBe(99);
  });
});
