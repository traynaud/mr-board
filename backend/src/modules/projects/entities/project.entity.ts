import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A GitLab repository configured to be scanned (singleton settings live in
 * `Settings`; there can be many of these). See RG-003-*.
 */
@Entity({ name: 'projects' })
export class Project {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'gitlab_project_id', type: 'integer' })
  gitlabProjectId!: number;

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
