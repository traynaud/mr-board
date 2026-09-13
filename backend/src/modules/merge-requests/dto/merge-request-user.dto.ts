/** Author/reviewer/assignee as embedded in `MergeRequestViewDto`. */
export class MergeRequestUserDto {
  username!: string;
  name!: string;
  avatarUrl!: string | null;
  /** True when this user is the currently configured identity (RG-G09, RG-023-05). */
  isMe!: boolean;
}
