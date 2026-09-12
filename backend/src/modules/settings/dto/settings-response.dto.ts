/** Response of `GET|PUT /api/v1/settings`. Never carries the token itself. */
export class SettingsResponseDto {
  gitlabUrl!: string;
  /** True when a readable token is stored. */
  tokenConfigured!: boolean;
  /** Last characters of the stored token, `null` when none. */
  tokenHint!: string | null;
  /** GitLab username used by "Mes MRs" and role matching (RG-002-01). */
  meUsername!: string | null;
  /** Fallback email for role matching (RG-002-01, RG-G09). */
  meEmail!: string | null;
  /** Scheduled sync cadence in minutes ; `0` = manual (RG-013-01). */
  refreshIntervalMin!: number;
  /** Suspend frontend polling/reload while the tab is hidden (RG-013-05). */
  pauseWhenHidden!: boolean;
}
