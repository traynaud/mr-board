/** Response of `POST /api/v1/settings/test-connection` on success. */
export class TestConnectionResultDto {
  username!: string;
  name!: string;
  avatarUrl!: string | null;
  /** ISO date of expiry, `null` when the token never expires or expiry is unknown. */
  expiresAt!: string | null;
  /** False when GitLab could not report the token metadata (non-personal token). */
  expirationKnown!: boolean;
}
