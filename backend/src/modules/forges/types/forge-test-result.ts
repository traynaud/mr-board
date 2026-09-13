/** Result of `ForgeClient.testConnection` on success (RG-001-04). */
export interface ForgeTestResult {
  username: string;
  name: string;
  avatarUrl: string | null;
  /** ISO date of expiry, `null` when the token never expires or expiry is unknown. */
  expiresAt: string | null;
  /** False when the forge could not report the token metadata (non-personal token). */
  expirationKnown: boolean;
}
