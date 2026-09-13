/** Subset of the GitHub REST `GET /repos/{owner}/{repo}` response (RG-020-06). */
export interface GithubRepo {
  /** Numeric repository id — RG-020-06 stores it as text (`remoteProjectId`), like every other forge. */
  id: number;
  /** Canonical `owner/repo` casing as GitHub returns it. */
  full_name: string;
  html_url: string;
}
