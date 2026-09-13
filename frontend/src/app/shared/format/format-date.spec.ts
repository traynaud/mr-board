import { formatDateTime, formatShortDate, formatTime } from './format-date';

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

  it('should_format_iso_date_in_english_as_iso_yyyy_mm_dd', () => {
    expect(formatShortDate('2027-03-12', 'en')).toBe('2027-03-12');
  });

  it('should_format_iso_datetime_in_english_as_iso_yyyy_mm_dd', () => {
    expect(formatShortDate('2026-09-05T14:30:00.000Z', 'en')).toBe('2026-09-05');
  });
});

describe('formatDateTime', () => {
  it('should_format_a_datetime_in_the_local_timezone_with_padding', () => {
    // Constructed from local components so the expectation holds regardless
    // of the machine's timezone (RG-007-04).
    const local = new Date(2027, 2, 5, 9, 5);

    expect(formatDateTime(local.toISOString())).toBe('05/03/2027 09:05');
  });

  it('should_format_a_datetime_without_leading_zero_needs', () => {
    const local = new Date(2026, 11, 25, 16, 30);

    expect(formatDateTime(local.toISOString())).toBe('25/12/2026 16:30');
  });

  it('should_return_input_when_not_a_date', () => {
    expect(formatDateTime('bientôt')).toBe('bientôt');
  });

  it('should_format_a_datetime_in_english_as_iso_yyyy_mm_dd', () => {
    const local = new Date(2027, 2, 5, 9, 5);

    expect(formatDateTime(local.toISOString(), 'en')).toBe('2027-03-05 09:05');
  });
});

describe('formatTime', () => {
  it('should_format_the_time_in_the_local_timezone_with_padding', () => {
    const local = new Date(2027, 2, 5, 9, 5);

    expect(formatTime(local.toISOString())).toBe('09:05');
  });

  it('should_format_the_time_without_leading_zero_needs', () => {
    const local = new Date(2026, 11, 25, 16, 30);

    expect(formatTime(local.toISOString())).toBe('16:30');
  });

  it('should_return_input_when_not_a_date', () => {
    expect(formatTime('bientôt')).toBe('bientôt');
  });
});
