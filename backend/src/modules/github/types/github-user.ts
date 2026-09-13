/** Subset of the GitHub REST `GET /user` response (RG-020-03). */
export interface GithubUser {
  login: string;
  name: string | null;
  avatar_url: string | null;
}
