import { Difficulty } from '../domain/calculate-difficulty';
import { ReadyLevel } from '../domain/calculate-ready-delay';
import { MergeRequestUserDto } from './merge-request-user.dto';
import { MergeStatusDto } from './merge-status.dto';

/**
 * Response of `GET /api/v1/merge-requests` (RG-005-11, extended by
 * RG-006-01, RG-007-01 and RG-017-06). Still no `labels` — added by the US
 * that displays them (US-015).
 */
export class MergeRequestViewDto {
  id!: number;
  projectAlias!: string;
  iid!: number;
  title!: string;
  webUrl!: string;
  draft!: boolean;
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
  /** ISO 8601, date d'ouverture GitLab — utilisé par le fallback draft (RG-007-05). */
  createdAt!: string;
  /** ISO 8601 ; `null` pour un draft (RG-004-04). */
  readyAt!: string | null;
  /** `null` pour un draft (RG-007-01). */
  readyDays!: number | null;
  /** `null` pour un draft (RG-007-01). */
  readyLevel!: ReadyLevel | null;
  /** Jours écoulés depuis `createdAt` ; toujours calculé, affiché uniquement pour un draft (RG-007-05). */
  openedDays!: number;
  /** `true` si je suis auteur, reviewer ou affecté (RG-G09) ; toujours calculé (RG-009-06). */
  isMine!: boolean;
  /** Mergeabilité GitLab (US-017, RG-017-06). `unknown` si la MR a été synchronisée avant cette US (RG-017-11). */
  mergeStatus!: MergeStatusDto;
}
