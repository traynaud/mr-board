/** Subset of `GET /api/v4/user`. */
export interface GitlabUser {
  id: number;
  username: string;
  name: string;
  /** Only present for the token's own account, never for a third party. */
  email: string | null;
  avatar_url: string | null;
  web_url: string;
}
