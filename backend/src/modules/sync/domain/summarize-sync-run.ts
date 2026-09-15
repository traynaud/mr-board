import { SyncRunStatus } from '../entities/sync-run.entity.js';

/**
 * Outcome of synchronising a single project during one run, or of a whole
 * connection at once when it has no token (RG-019-16) — in that case
 * `projectAlias` is empty and `errorMessage` already names every affected
 * repo, so it is never re-prefixed.
 */
export interface ProjectSyncOutcome {
  projectAlias: string;
  success: boolean;
  /** Number of merge requests processed. Only meaningful when `success`. */
  mrCount?: number;
  /** Failure cause. Only meaningful when `!success`. */
  errorMessage?: string;
}

export interface SyncRunSummary {
  status: SyncRunStatus;
  mrCount: number;
  errorMessage: string | null;
}

/**
 * Aggregates the per-project outcomes of a sync run into its overall
 * status and a short text summary of the failures (RG-004-06). A single
 * failure among several successes yields `partial`; a run with no project
 * to synchronise (or nothing but failures being impossible, i.e. an empty
 * list) yields `success` with `mrCount: 0`.
 * @see RG-004-06
 */
export function summarizeSyncRun(
  outcomes: ProjectSyncOutcome[],
): SyncRunSummary {
  const failed = outcomes.filter((outcome) => !outcome.success);
  const succeeded = outcomes.filter((outcome) => outcome.success);
  const mrCount = succeeded.reduce(
    (sum, outcome) => sum + (outcome.mrCount ?? 0),
    0,
  );

  let status: SyncRunStatus;
  if (failed.length === 0) {
    status = 'success';
  } else if (succeeded.length === 0) {
    status = 'error';
  } else {
    status = 'partial';
  }

  const errorMessage =
    failed.length === 0
      ? null
      : failed
          .map((outcome) =>
            outcome.projectAlias
              ? `${outcome.projectAlias}: ${outcome.errorMessage}`
              : outcome.errorMessage,
          )
          .join('; ');

  return { status, mrCount, errorMessage };
}
