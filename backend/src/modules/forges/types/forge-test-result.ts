/** Result of `ForgeClient.testConnection` on success (RG-001-04). */
export interface ForgeTestResult {
  username: string;
  name: string;
  avatarUrl: string | null;
  /** ISO date of expiry, `null` when the token never expires or expiry is unknown. */
  expiresAt: string | null;
  /** False when the forge could not report the token metadata (non-personal token). */
  expirationKnown: boolean;
  /**
   * False when the forge could not report the token's scopes/permissions,
   * so no scope check was performed (RG-020-03: a GitHub fine-grained
   * token). GitLab always reports scopes when its token-info endpoint
   * responds, so it sets this to the same signal as `expirationKnown`.
   */
  scopeKnown: boolean;
}
