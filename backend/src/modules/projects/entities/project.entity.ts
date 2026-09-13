import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A repository configured to be scanned, belonging to exactly one
 * `Connection` (RG-019-04). See RG-003-*.
 */
@Entity({ name: 'projects' })
export class Project {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'connection_id', type: 'integer' })
  connectionId!: number;

  /** Text because GitHub exposes string `node_id`s (RG-019-05). Unique per connection. */
  @Column({ name: 'remote_project_id', type: 'text' })
  remoteProjectId!: string;

  /** Unique per connection, case-insensitive (RG-019-04). */
  @Column({ name: 'path_with_namespace', type: 'text' })
  pathWithNamespace!: string;

  /** Unique, case-insensitive (`COLLATE NOCASE` at the SQL level, RG-003-04). */
  @Column({ type: 'text' })
  alias!: string;

  @Column({ name: 'web_url', type: 'text' })
  webUrl!: string;

  /** Reserved for a future "suspend without deleting" feature (QO-003-01). */
  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ name: 'created_at', type: 'text' })
  createdAt!: string;
}
