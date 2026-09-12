import { MergeRequestViewDto } from './merge-request-view.dto';

/**
 * Response of `GET /api/v1/merge-requests`. `warnings` carries non-fatal
 * notices (RG-009-02: `identity.missing` when `mine=1` was requested but
 * no identity is configured) — always present, usually empty.
 */
export class MergeRequestsResponseDto {
  mergeRequests!: MergeRequestViewDto[];
  warnings!: string[];
}
