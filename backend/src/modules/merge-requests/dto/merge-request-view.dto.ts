import { Difficulty } from '../domain/calculate-difficulty';
import { ReadyLevel } from '../domain/calculate-ready-delay';
import { ConnectionSummaryDto } from './connection-summary.dto';
import { MergeRequestUserDto } from './merge-request-user.dto';
import { MergeStatusDto } from './merge-status.dto';

/**
 * Response of `GET /api/v1/merge-requests` (RG-005-11, extended by
 * RG-006-01, RG-007-01, RG-017-06 and RG-028-01).
 */
export class MergeRequestViewDto {
  id!: number;
  projectAlias!: string;
  iid!: number;
  title!: string;
  webUrl!: string;
  draft!: boolean;
  /** Raw forge label strings, in forge order (RG-028-01/02). Never includes an ignored label (RG-028-04). */
  labels!: string[];
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
  /** Annotation locale (RG-027-01/04), toujours calculée qu'elle soit filtrée ou non. */
  isFavorite!: boolean;
  /** GitLab mergeability (US-017, RG-017-06). `unknown` for a merge request synced before this US (RG-017-11). */
  mergeStatus!: MergeStatusDto;
  /** Connection the merge request's project belongs to (RG-019-22). */
  connection!: ConnectionSummaryDto;
}
