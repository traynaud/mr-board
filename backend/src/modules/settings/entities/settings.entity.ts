import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Identifier of the single settings row. */
export const SETTINGS_ID = 1;

/** Default GitLab instance. */
export const DEFAULT_GITLAB_URL = 'https://gitlab.com';

/**
 * Application settings (singleton row, `id = 1`).
 * Columns are added by each user story through dedicated migrations.
 */
@Entity({ name: 'settings' })
export class Settings {
  @PrimaryColumn({ type: 'integer' })
  id!: number;

  @Column({ name: 'gitlab_url', type: 'text', default: DEFAULT_GITLAB_URL })
  gitlabUrl!: string;

  /** Encrypted GitLab token (see TokenCipherService), `null` when not configured. */
  @Column({ name: 'gitlab_token_encrypted', type: 'text', nullable: true })
  gitlabTokenEncrypted!: string | null;

  @Column({ name: 'updated_at', type: 'text' })
  updatedAt!: string;
}
