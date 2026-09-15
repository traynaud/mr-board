import {
  DEFAULT_READY_DELAY_THRESHOLDS,
  calculateElapsedDays,
  readyLevelForDays,
} from './calculate-ready-delay.js';

describe('calculateElapsedDays', () => {
  const NOW = '2026-09-11T10:00:00Z';

  it.each([
    ['2026-09-11T08:00:00Z', 0],
    ['2026-09-10T09:00:00Z', 1],
    ['2026-09-09T09:00:00Z', 2],
    ['2026-09-08T09:00:00Z', 3],
    ['2026-09-07T09:00:00Z', 4],
    ['2026-09-01T09:00:00Z', 10],
  ])(
    'should_floor_the_number_of_calendar_days_since_%s',
    (readyAt, expectedDays) => {
      expect(calculateElapsedDays(readyAt, NOW, false)).toBe(expectedDays);
    },
  );

  it('should_count_only_workdays_between_friday_evening_and_monday_morning', () => {
    const fridayReady = '2026-09-11T17:00:00Z';
    const mondayMorning = '2026-09-14T10:00:00Z';

    expect(calculateElapsedDays(fridayReady, mondayMorning, true)).toBe(0);
  });

  it('should_count_one_workday_between_friday_evening_and_tuesday_morning', () => {
    const fridayReady = '2026-09-11T17:00:00Z';
    const tuesdayMorning = '2026-09-15T10:00:00Z';

    expect(calculateElapsedDays(fridayReady, tuesdayMorning, true)).toBe(1);
  });

  it('should_return_zero_before_any_full_calendar_day_has_elapsed_in_workdays_mode', () => {
    expect(calculateElapsedDays('2026-09-11T08:00:00Z', NOW, true)).toBe(0);
  });
});

describe('readyLevelForDays', () => {
  it.each([
    [0, 'green'],
    [1, 'green'],
    [2, 'orange'],
    [3, 'orange'],
    [4, 'red'],
    [10, 'red'],
  ])('should_report_%s_days_as_%s', (days, expectedLevel) => {
    expect(readyLevelForDays(days, DEFAULT_READY_DELAY_THRESHOLDS)).toBe(
      expectedLevel,
    );
  });
});
