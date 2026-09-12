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

  /** GitLab username of the current user, used by "Mes MRs" (RG-002-01). */
  @Column({ name: 'me_username', type: 'text', nullable: true })
  meUsername!: string | null;

  /** Fallback email for role matching (RG-002-01, RG-G09). */
  @Column({ name: 'me_email', type: 'text', nullable: true })
  meEmail!: string | null;

  /** Scheduled sync cadence in minutes ; `0` = manual (RG-013-01). */
  @Column({ name: 'refresh_interval_min', type: 'integer', default: 5 })
  refreshIntervalMin!: number;

  /** Suspend frontend polling/reload while the tab is hidden (RG-013-05) ; not read by the backend. */
  @Column({ name: 'pause_when_hidden', type: 'boolean', default: true })
  pauseWhenHidden!: boolean;

  @Column({ name: 'updated_at', type: 'text' })
  updatedAt!: string;
}
