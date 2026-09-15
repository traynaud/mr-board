import { SyncRunDto } from './sync-run.dto.js';

/** Response of `GET /api/v1/sync/status` (RG-004-08). */
export class SyncStatusResponseDto {
  running!: boolean;
  lastRun!: SyncRunDto | null;
  /** Next scheduled sync due date, `null` in manual mode (RG-013-01/02/03/07). */
  nextRunAt!: string | null;
}
