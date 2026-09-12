import { SyncRunStatus, SyncTrigger } from '../entities/sync-run.entity';

/** Trace of one completed synchronisation run (RG-004-06). */
export class SyncRunDto {
  startedAt!: string;
  finishedAt!: string;
  status!: SyncRunStatus;
  mrCount!: number;
  errorMessage!: string | null;
  trigger!: SyncTrigger;
}
