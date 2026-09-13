/**
 * A user account on a forge (author, reviewer or assignee), already
 * normalised by the forge's own mapper (US-019). `remoteUserId` is text
 * because GitHub exposes string `node_id`s where GitLab exposes numeric ids.
 */
export interface ForgeUser {
  remoteUserId: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  webUrl: string;
}
