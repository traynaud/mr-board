import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type SyncRunStatus = 'success' | 'partial' | 'error';
export type SyncTrigger = 'manual' | 'scheduled';

/**
 * Trace of one synchronisation run (RG-004-06). Written once, after
 * completion — the `running` state exposed by `GET /sync/status` comes from
 * `SyncService`'s in-memory lock, not from a row here.
 */
@Entity({ name: 'sync_runs' })
export class SyncRun {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'started_at', type: 'text' })
  startedAt!: string;

  @Column({ name: 'finished_at', type: 'text' })
  finishedAt!: string;

  @Column({ type: 'text' })
  status!: SyncRunStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'mr_count', type: 'integer' })
  mrCount!: number;

  @Column({ type: 'text' })
  trigger!: SyncTrigger;
}
