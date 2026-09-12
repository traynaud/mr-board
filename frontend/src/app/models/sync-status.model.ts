/** Miroir de `SyncRunDto` (backend). */
export interface SyncRun {
  startedAt: string;
  finishedAt: string;
  status: 'success' | 'partial' | 'error';
  mrCount: number;
  errorMessage: string | null;
  trigger: 'manual' | 'scheduled';
}

/** Réponse de `GET /api/v1/sync/status`. */
export interface SyncStatus {
  running: boolean;
  lastRun: SyncRun | null;
  /** Prochaine échéance de synchro planifiée, `null` en mode manuel (RG-013). */
  nextRunAt: string | null;
}

/** Réponse de `POST /api/v1/sync`. */
export interface SyncTriggerResponse {
  running: true;
}
