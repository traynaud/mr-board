import { computeNextRunAt } from './compute-next-run-at';

describe('computeNextRunAt', () => {
  it('should_return_null_in_manual_mode', () => {
    expect(
      computeNextRunAt(
        0,
        '2026-09-12T10:00:00.000Z',
        '2026-09-12T10:02:00.000Z',
      ),
    ).toBeNull();
  });

  it('should_return_null_in_manual_mode_even_when_never_synced', () => {
    expect(computeNextRunAt(0, null, '2026-09-12T10:00:00.000Z')).toBeNull();
  });

  it('should_be_due_immediately_when_never_synced', () => {
    expect(computeNextRunAt(5, null, '2026-09-12T10:00:00.000Z')).toBe(
      '2026-09-12T10:00:00.000Z',
    );
  });

  it('should_add_the_interval_to_the_last_run_start', () => {
    expect(
      computeNextRunAt(
        15,
        '2026-09-12T10:00:00.000Z',
        '2026-09-12T10:01:00.000Z',
      ),
    ).toBe('2026-09-12T10:15:00.000Z');
  });

  it('should_return_a_past_timestamp_when_already_overdue', () => {
    expect(
      computeNextRunAt(
        5,
        '2026-09-12T10:00:00.000Z',
        '2026-09-12T10:30:00.000Z',
      ),
    ).toBe('2026-09-12T10:05:00.000Z');
  });

  it('should_base_the_computation_on_the_last_run_regardless_of_its_trigger', () => {
    const afterManualTrigger = computeNextRunAt(
      30,
      '2026-09-12T10:20:00.000Z',
      '2026-09-12T10:21:00.000Z',
    );

    expect(afterManualTrigger).toBe('2026-09-12T10:50:00.000Z');
  });
});
