import { MergeRequestUserDto } from './merge-request-user.dto';

/**
 * Response of `GET /api/v1/merge-requests` (RG-005-11). Deliberately
 * minimal: no `draft`, `difficulty`, `readyAt`/`readyDays`/`readyLevel`,
 * diff stats or `labels` — those are added by the US that displays them
 * (US-006, US-007, US-009, US-015).
 */
export class MergeRequestViewDto {
  id!: number;
  projectAlias!: string;
  iid!: number;
  title!: string;
  webUrl!: string;
  author!: MergeRequestUserDto;
  reviewers!: MergeRequestUserDto[];
  assignees!: MergeRequestUserDto[];
  approved!: boolean;
  commentsCount!: number;
}
