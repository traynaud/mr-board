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
}
