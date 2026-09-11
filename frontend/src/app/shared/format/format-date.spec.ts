import { formatShortDate } from './format-date';

describe('formatShortDate', () => {
  it('should_format_iso_date', () => {
    expect(formatShortDate('2027-03-12')).toBe('12/03/2027');
  });

  it('should_format_iso_datetime', () => {
    expect(formatShortDate('2026-09-05T14:30:00.000Z')).toBe('05/09/2026');
  });

  it('should_return_input_when_not_a_date', () => {
    expect(formatShortDate('bientôt')).toBe('bientôt');
  });
});
