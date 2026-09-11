/** Subset of `GET /api/v4/personal_access_tokens/self`. */
export interface GitlabTokenInfo {
  id: number;
  name: string;
  scopes: string[];
  active: boolean;
  /** ISO date (`YYYY-MM-DD`) or `null` when the token never expires. */
  expires_at: string | null;
}
