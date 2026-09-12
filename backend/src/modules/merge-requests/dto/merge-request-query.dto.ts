import { IsIn, IsOptional } from 'class-validator';
import { SORT_PARAMS, type SortParam } from '../domain/sort-merge-requests';

const BOOLEAN_PARAMS = ['0', '1'] as const;
type BooleanParam = (typeof BOOLEAN_PARAMS)[number];

/** Query params of `GET /api/v1/merge-requests` (RG-008-07, RG-009-01/02). */
export class MergeRequestQueryDto {
  /** `ready:asc|ready:desc|diff:asc|diff:desc`. Defaults to `ready:asc` when absent (RG-008-01). */
  @IsOptional()
  @IsIn(SORT_PARAMS)
  sort?: SortParam;

  /** `1` includes drafts after the Ready block. Defaults to `0` (RG-009-01). */
  @IsOptional()
  @IsIn(BOOLEAN_PARAMS)
  drafts?: BooleanParam;

  /** `1` restricts to merge requests where I have a role. Defaults to `0` (RG-009-02). */
  @IsOptional()
  @IsIn(BOOLEAN_PARAMS)
  mine?: BooleanParam;
}
