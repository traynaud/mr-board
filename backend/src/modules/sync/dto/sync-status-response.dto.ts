import { SyncRunDto } from './sync-run.dto';

/** Response of `GET /api/v1/sync/status` (RG-004-08). */
export class SyncStatusResponseDto {
  running!: boolean;
  lastRun!: SyncRunDto | null;
  /** Always `null` until US-013 (scheduled synchronisation) exists. */
  nextRunAt!: null;
}
