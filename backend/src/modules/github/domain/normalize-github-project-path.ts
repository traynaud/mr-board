/**
 * Normalises a GitHub repository path: accepts either a bare `owner/repo`
 * path or a full GitHub URL, and returns the path alone — no scheme, no
 * host, no `/pulls` suffix, no `.git` suffix, no leading/trailing slash
 * (RG-020-05). Does **not** validate the segment count — GitHub requires
 * exactly two (`owner/repo`), but that check belongs to the caller
 * (`GithubClientService.normalizePath`), which can throw a business
 * exception; this pure function only ever returns `null` or a string.
 * @param input raw user input.
 * @returns the normalised path, or `null` when the result would be empty.
 */
export function normalizeGithubProjectPath(input: string): string | null {
  let value = input.trim();
  if (/^https?:\/\//i.test(value)) {
    try {
      value = new URL(value).pathname;
    } catch {
      return null;
    }
  }
  value = value.replace(/\/pulls(?:\/.*)?$/i, '');
  value = value.replace(/\.git$/i, '');
  value = value.replace(/^\/+|\/+$/g, '');
  return value.length > 0 ? value : null;
}
