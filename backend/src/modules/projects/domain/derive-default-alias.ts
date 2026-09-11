/**
 * Derives a default alias from a normalised project path: the last path
 * segment (`equipe/backend-api` → `backend-api`). See RG-003-05.
 * @param path a path already normalised by `normalizeProjectPath`.
 */
export function deriveDefaultAlias(path: string): string {
  const segments = path.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? path;
}
