export type ReadyLevel = 'green' | 'orange' | 'red';

export interface ReadyDelayThresholds {
  greenDays: number;
  orangeDays: number;
}

/** Default thresholds of RG-007-03. Used as-is until US-014 lets the user configure them. */
export const DEFAULT_READY_DELAY_THRESHOLDS: ReadyDelayThresholds = {
  greenDays: 1,
  orangeDays: 3,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Number of full days elapsed between two ISO 8601 instants (RG-G04,
 * `floor`). `workdaysOnly` excludes every Saturday/Sunday crossed between
 * `fromIso` and `nowIso` (RG-007-06) — always called with `false` until
 * US-014 introduces the setting.
 * @see RG-G04
 */
export function calculateElapsedDays(
  fromIso: string,
  nowIso: string,
  workdaysOnly: boolean,
): number {
  const totalDays = Math.floor(
    (Date.parse(nowIso) - Date.parse(fromIso)) / MS_PER_DAY,
  );
  if (!workdaysOnly || totalDays === 0) {
    return totalDays;
  }

  const from = new Date(fromIso);
  let workdays = 0;
  for (let i = 1; i <= totalDays; i += 1) {
    const day = new Date(from);
    day.setUTCDate(day.getUTCDate() + i);
    const weekday = day.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      workdays += 1;
    }
  }
  return workdays;
}

/**
 * Ready delay severity level (RG-007-03): `green` if `days` ≤ `greenDays`,
 * `orange` if `days` ≤ `orangeDays`, `red` beyond.
 * @see RG-007-03
 */
export function readyLevelForDays(
  days: number,
  thresholds: ReadyDelayThresholds,
): ReadyLevel {
  if (days <= thresholds.greenDays) {
    return 'green';
  }
  if (days <= thresholds.orangeDays) {
    return 'orange';
  }
  return 'red';
}
