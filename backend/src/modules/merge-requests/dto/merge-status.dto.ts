import {
  MergeStatusReasonCode,
  MergeStatusState,
} from '../../forges/types/merge-status';

/** One blocking reason of `MergeStatusDto.reasons` (RG-017-06). */
export class MergeStatusReasonDto {
  code!: MergeStatusReasonCode;
  /** Only set for `not_approved` and `discussions_unresolved`. */
  count?: number;
}

/**
 * Mergeability of a merge request (US-017, RG-017-06). Never carries a
 * translated label — the frontend resolves `reasons[].code` through
 * `board.mergeRequests.mergeStatus.reasons.<code>`.
 */
export class MergeStatusDto {
  state!: MergeStatusState;
  reasons!: MergeStatusReasonDto[];
}
