/** Subset of `GET /api/v4/user`. */
export interface GitlabUser {
  id: number;
  username: string;
  name: string;
  avatar_url: string | null;
  web_url: string;
}
