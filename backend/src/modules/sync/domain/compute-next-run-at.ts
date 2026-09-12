/**
 * Computes the timestamp of the next scheduled synchronisation
 * (RG-013-02, RG-013-03, RG-013-07): "next due date = last run + interval".
 * @param refreshIntervalMin cadence in minutes ; `0` means manual mode.
 * @param lastRunStartedAt `startedAt` of the last sync run (any trigger), `null` when none ran yet.
 * @param now current time, ISO 8601.
 * @returns the next due date (ISO 8601), or `null` in manual mode.
 */
export function computeNextRunAt(
  refreshIntervalMin: number,
  lastRunStartedAt: string | null,
  now: string,
): string | null {
  if (refreshIntervalMin === 0) {
    return null;
  }
  if (lastRunStartedAt === null) {
    return now;
  }
  const next =
    new Date(lastRunStartedAt).getTime() + refreshIntervalMin * 60_000;
  return new Date(next).toISOString();
}
