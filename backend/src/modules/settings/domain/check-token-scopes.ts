/** Scopes granting read access to the GitLab API. */
export const ACCEPTED_SCOPES: readonly string[] = ['read_api', 'api'];

/**
 * Whether the token scopes allow MR Board to read merge requests (RG-001-04).
 * @param scopes scopes reported by GitLab.
 */
export function hasRequiredScope(scopes: readonly string[]): boolean {
  return scopes.some((scope) => ACCEPTED_SCOPES.includes(scope));
}
