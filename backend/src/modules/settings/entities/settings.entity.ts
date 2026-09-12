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

  /** Difficulty thresholds (RG-G03, RG-014-01). */
  @Column({ name: 'easy_files', type: 'integer', default: 5 })
  easyFiles!: number;

  @Column({ name: 'easy_lines', type: 'integer', default: 100 })
  easyLines!: number;

  @Column({ name: 'hard_files', type: 'integer', default: 20 })
  hardFiles!: number;

  @Column({ name: 'hard_lines', type: 'integer', default: 800 })
  hardLines!: number;

  /** Ready delay thresholds in days (RG-G04, RG-014-01). */
  @Column({ name: 'ready_green_days', type: 'integer', default: 1 })
  readyGreenDays!: number;

  @Column({ name: 'ready_orange_days', type: 'integer', default: 3 })
  readyOrangeDays!: number;

  /** Count only Monday-Friday for the Ready delay (RG-G04, RG-014-01). */
  @Column({ name: 'workdays_only', type: 'boolean', default: false })
  workdaysOnly!: boolean;

  /** Open MR titles in a new tab (RG-G11, RG-015-01). */
  @Column({ name: 'open_in_new_tab', type: 'boolean', default: false })
  openInNewTab!: boolean;

  /** JSON-encoded `string[]` of labels that hide a merge request (RG-015-02). */
  @Column({ name: 'ignored_labels', type: 'text', default: '[]' })
  ignoredLabels!: string;

  @Column({ name: 'updated_at', type: 'text' })
  updatedAt!: string;
}
