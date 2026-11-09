import {
  MAX_ENRICHMENT_ATTEMPTS,
  computeRetryDelayMs,
} from './compute-retry-delay.js';

describe('computeRetryDelayMs', () => {
  it('should_double_the_delay_after_each_failed_attempt', () => {
    expect([1, 2, 3, 4].map(computeRetryDelayMs)).toEqual([
      60_000, 120_000, 240_000, 480_000,
    ]);
  });

  it('should_return_null_once_the_attempts_are_exhausted', () => {
    expect(computeRetryDelayMs(MAX_ENRICHMENT_ATTEMPTS)).toBeNull();
    expect(computeRetryDelayMs(MAX_ENRICHMENT_ATTEMPTS + 3)).toBeNull();
  });

  it('should_use_the_base_delay_for_a_zero_attempt_count', () => {
    expect(computeRetryDelayMs(0)).toBe(60_000);
  });
});
