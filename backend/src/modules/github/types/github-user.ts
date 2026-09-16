/** Subset of the GitHub REST `GET /user` response (RG-020-03). */
export interface GithubUser {
  login: string;
  name: string | null;
  /** Public email of the account, `null` when private/unset (RG-031-02). */
  email: string | null;
  avatar_url: string | null;
}
