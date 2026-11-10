import { TestBed } from '@angular/core/testing';
import { DateAdapter } from '@angular/material/core';
import { provideI18nTesting } from '../../../core/i18n/testing';
import { AppDateAdapter } from './app-date-adapter';

describe('AppDateAdapter', () => {
  const adapter = (language: 'fr' | 'en' = 'fr') => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideI18nTesting(language), AppDateAdapter, { provide: DateAdapter, useExisting: AppDateAdapter }],
    });
    return TestBed.inject(AppDateAdapter);
  };

  it('should_read_french_day_month_year_not_the_american_order', () => {
    const date = adapter().parse('01/11/2026') as Date;
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 10, 1]);
    const padded = adapter().parse(' 6/11/2026 ') as Date;
    expect([padded.getMonth(), padded.getDate()]).toEqual([10, 6]);
  });

  it('should_read_iso_days_in_any_language', () => {
    const date = adapter('en').parse('2026-11-09') as Date;
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 10, 9]);
  });

  it('should_return_null_for_blank_and_an_invalid_date_otherwise', () => {
    const a = adapter();
    expect(a.parse('  ')).toBeNull();
    for (const bad of ['31/02/2026', 'hier', '2026-13-01', '11/2026']) {
      expect(a.isValid(a.parse(bad) as Date)).toBe(false);
    }
  });

  it('should_format_by_language', () => {
    const day = new Date(2026, 10, 6);
    expect(adapter('fr').format(day, {})).toBe('06/11/2026');
    expect(adapter('en').format(day, {})).toBe('2026-11-06');
  });

  it('should_refuse_to_format_an_invalid_date', () => {
    const a = adapter();
    expect(() => a.format(a.invalid(), {})).toThrow();
  });
});
