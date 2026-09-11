/**
 * Normalises a GitLab project path: accepts either a bare path
 * (`groupe/sous-groupe/projet`) or a full GitLab URL, and returns the path
 * alone — no scheme, no host, no `/-/…` suffix (merge_requests, tree…), no
 * leading/trailing slash. See RG-003-01.
 *
 * No further format validation is applied: GitLab's own response when
 * resolving the project (RG-003-03) is the actual source of truth.
 * @param input raw user input.
 * @returns the normalised path, or `null` when the result would be empty.
 */
export function normalizeProjectPath(input: string): string | null {
  let value = input.trim();
  if (/^https?:\/\//i.test(value)) {
    try {
      value = new URL(value).pathname;
    } catch {
      return null;
    }
  }
  value = value.replace(/\/-\/.*$/, '');
  value = value.replace(/^\/+|\/+$/g, '');
  return value.length > 0 ? value : null;
}
