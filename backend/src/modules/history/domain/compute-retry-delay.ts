/** Attempts allowed before an entry is abandoned (RG-034-07). */
export const MAX_ENRICHMENT_ATTEMPTS = 5;

const BASE_DELAY_MS = 60_000;

/**
 * Wait before the next attempt after `attempts` failures (RG-034-07):
 * 1, 2, 4, 8 minutes. `null` once the attempts are exhausted.
 */
export function computeRetryDelayMs(attempts: number): number | null {
  if (attempts >= MAX_ENRICHMENT_ATTEMPTS) {
    return null;
  }
  return BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1);
}
