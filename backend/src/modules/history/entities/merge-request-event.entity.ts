import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Kinds of journal events (RG-033-03). */
export type HistoryEventType =
  | 'created'
  | 'title_changed'
  | 'marked_draft'
  | 'marked_ready'
  | 'approved'
  | 'approval_removed'
  | 'reviewer_added'
  | 'reviewer_removed'
  | 'assignee_added'
  | 'assignee_removed'
  | 'label_added'
  | 'label_removed'
  | 'commented'
  | 'merged'
  | 'closed'
  | 'reopened'
  | 'deleted'
  | 'disappeared';

/** `provisional`: inferred from a state comparison; `confirmed`: matched with the forge (US-034). */
export type HistoryEventStatus = 'provisional' | 'confirmed';

/**
 * One entry of the merge request history (RG-033-02). Deliberately has no
 * foreign key to `merge_requests` or `users`: it carries a denormalised
 * snapshot (title, URL, project alias, actor) so it outlives the physical
 * deletion of the merge request (RG-G01).
 */
@Entity({ name: 'merge_request_events' })
export class MergeRequestEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'occurred_at', type: 'text' })
  occurredAt!: string;

  @Column({ name: 'detected_at', type: 'text' })
  detectedAt!: string;

  @Column({ type: 'text' })
  type!: HistoryEventType;

  @Column({ type: 'text', default: 'provisional' })
  status!: HistoryEventStatus;

  /** Identifier of the matching forge event, once confirmed (US-034). */
  @Column({ name: 'source_event_id', type: 'text', nullable: true })
  sourceEventId!: string | null;

  @Column({ name: 'connection_id', type: 'integer' })
  connectionId!: number;

  @Column({ name: 'project_id', type: 'integer' })
  projectId!: number;

  @Column({ name: 'mr_iid', type: 'integer' })
  mrIid!: number;

  @Column({ name: 'mr_title', type: 'text' })
  mrTitle!: string;

  @Column({ name: 'mr_web_url', type: 'text' })
  mrWebUrl!: string;

  @Column({ name: 'project_alias', type: 'text' })
  projectAlias!: string;

  @Column({ name: 'actor_username', type: 'text', nullable: true })
  actorUsername!: string | null;

  @Column({ name: 'actor_name', type: 'text', nullable: true })
  actorName!: string | null;

  @Column({ name: 'actor_avatar_url', type: 'text', nullable: true })
  actorAvatarUrl!: string | null;

  /** JSON-serialised previous value. */
  @Column({ name: 'old_value', type: 'text', nullable: true })
  oldValue!: string | null;

  /** JSON-serialised new value. */
  @Column({ name: 'new_value', type: 'text', nullable: true })
  newValue!: string | null;
}
