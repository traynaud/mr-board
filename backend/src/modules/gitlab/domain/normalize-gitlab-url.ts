/**
 * Normalises a GitLab instance URL: trims, keeps only `scheme://host[:port]`
 * and drops any path (`/api/v4`, trailing slash…). See RG-001-01.
 * @param input raw user input.
 * @returns the normalised origin, or `null` when the input is not an http(s) URL.
 */
export function normalizeGitlabUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    if (!url.hostname) {
      return null;
    }
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}
