import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A merge request waiting for forge-side enrichment (RG-034-02): at most
 * one row per (`project_id`, `mr_iid`), refreshed in place by every new
 * trigger. Identified logically, never by a `merge_requests` row id.
 */
@Entity({ name: 'history_queue' })
export class HistoryQueueEntry {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'project_id', type: 'integer' })
  projectId!: number;

  @Column({ name: 'mr_iid', type: 'integer' })
  mrIid!: number;

  @Column({ name: 'mr_title', type: 'text' })
  mrTitle!: string;

  @Column({ name: 'mr_web_url', type: 'text' })
  mrWebUrl!: string;

  @Column({ name: 'requested_at', type: 'text' })
  requestedAt!: string;

  @Column({ type: 'integer', default: 0 })
  attempts!: number;

  @Column({ name: 'next_attempt_at', type: 'text', nullable: true })
  nextAttemptAt!: string | null;
}
