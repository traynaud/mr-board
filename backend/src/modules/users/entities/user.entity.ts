import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A user encountered on a connection while synchronising merge requests
 * (author, reviewer or assignee). Upserted by (`connectionId`,
 * `remoteUserId`) — RG-019-05. See US-004.
 */
@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'connection_id', type: 'integer' })
  connectionId!: number;

  /** Text because GitHub exposes string `node_id`s (RG-019-05). */
  @Column({ name: 'remote_user_id', type: 'text' })
  remoteUserId!: string;

  @Column({ type: 'text' })
  username!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl!: string | null;

  @Column({ name: 'web_url', type: 'text' })
  webUrl!: string;
}
