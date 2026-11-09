import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** `update`: changes to enrich; `disappeared`: left the open list, look up its final state (US-035). */
export type HistoryQueueKind = 'update' | 'disappeared';

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

  @Column({ type: 'text', default: 'update' })
  kind!: HistoryQueueKind;

  @Column({ name: 'requested_at', type: 'text' })
  requestedAt!: string;

  /** Start of the window to re-read on the forge; `null` → `requestedAt` (US-033 rows). */
  @Column({ type: 'text', nullable: true })
  since!: string | null;

  /** JSON `string[]` of the usernames concerned, carried to the events the entry creates (US-041). */
  @Column({ name: 'mr_involved_usernames', type: 'text', nullable: true })
  mrInvolvedUsernames!: string | null;

  @Column({ type: 'integer', default: 0 })
  attempts!: number;

  @Column({ name: 'next_attempt_at', type: 'text', nullable: true })
  nextAttemptAt!: string | null;
}
