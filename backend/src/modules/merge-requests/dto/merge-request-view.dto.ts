import { Difficulty } from '../domain/calculate-difficulty';
import { MergeRequestUserDto } from './merge-request-user.dto';

/**
 * Response of `GET /api/v1/merge-requests` (RG-005-11, extended by
 * RG-006-01). Still no `draft`, `readyAt`/`readyDays`/`readyLevel` or
 * `labels` — those are added by the US that displays them (US-007, US-009,
 * US-015).
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
  difficulty!: Difficulty;
  /** `null` when the diff stats were unavailable at sync time (RG-006-02). */
  changedFiles!: number | null;
  additions!: number | null;
  deletions!: number | null;
  /** `additions + deletions`, `null` iff the diff stats are unavailable. */
  changedLines!: number | null;
}
