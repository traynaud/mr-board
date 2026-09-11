/** Response of `GET|PUT /api/v1/settings`. Never carries the token itself. */
export class SettingsResponseDto {
  gitlabUrl!: string;
  /** True when a readable token is stored. */
  tokenConfigured!: boolean;
  /** Last characters of the stored token, `null` when none. */
  tokenHint!: string | null;
}
