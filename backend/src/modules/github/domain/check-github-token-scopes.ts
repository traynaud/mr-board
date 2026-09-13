/** Scopes granting read access to pull requests on a classic GitHub PAT (RG-020-02). */
export const ACCEPTED_SCOPES: readonly string[] = ['repo', 'public_repo'];

/**
 * Whether the token scopes allow MR Board to read pull requests (RG-020-03).
 * Only meaningful for a classic PAT — a fine-grained token never exposes
 * scopes this way (`GithubClientService.testConnection` skips this check
 * entirely when the `X-OAuth-Scopes` header is absent).
 * @param scopes scopes reported by GitHub.
 */
export function hasRequiredScope(scopes: readonly string[]): boolean {
  return scopes.some((scope) => ACCEPTED_SCOPES.includes(scope));
}
