/** REST and GraphQL API base URLs for a GitHub connection (RG-020-01). */
export interface GithubApiBases {
  rest: string;
  graphql: string;
}

/** The public github.com origin, as normalised by `normalizeUrl` (lowercase, no trailing slash). */
const GITHUB_COM_ORIGIN = 'https://github.com';

/**
 * Derives the REST and GraphQL API base URLs from a connection's already
 * normalised origin (RG-020-01) — the user never enters an API URL
 * directly. `github.com` uses the dedicated `api.github.com` host; any
 * other origin is treated as a GitHub Enterprise Server instance, whose API
 * lives under `/api/v3` (REST) and `/api/graphql` (GraphQL) on the same host.
 * @param origin an origin already normalised by `ForgeClient.normalizeUrl` (RG-001-01).
 */
export function deriveGithubApiBases(origin: string): GithubApiBases {
  if (origin === GITHUB_COM_ORIGIN) {
    return {
      rest: 'https://api.github.com',
      graphql: 'https://api.github.com/graphql',
    };
  }
  return {
    rest: `${origin}/api/v3`,
    graphql: `${origin}/api/graphql`,
  };
}
