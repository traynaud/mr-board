import { IsIn, IsOptional } from 'class-validator';
import { SORT_PARAMS, type SortParam } from '../domain/sort-merge-requests';

/** Query params of `GET /api/v1/merge-requests` (RG-008-07). */
export class MergeRequestQueryDto {
  /** `ready:asc|ready:desc|diff:asc|diff:desc`. Defaults to `ready:asc` when absent (RG-008-01). */
  @IsOptional()
  @IsIn(SORT_PARAMS)
  sort?: SortParam;
}
