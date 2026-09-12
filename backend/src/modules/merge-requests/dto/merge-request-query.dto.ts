import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { SORT_PARAMS, type SortParam } from '../domain/sort-merge-requests';

const BOOLEAN_PARAMS = ['0', '1'] as const;
type BooleanParam = (typeof BOOLEAN_PARAMS)[number];

/** `a,b, c` → `['a', 'b', 'c']` ; absent/blank → `[]` (RG-010-01, CSV multi-value params). */
function toArray({ value }: { value: unknown }): string[] {
  if (typeof value !== 'string') {
    return [];
  }
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Filter query params shared by `GET /merge-requests` and
 * `GET /merge-requests/facets` (RG-009-01/02, RG-010-01/12). Unknown
 * `project`/`author`/`assigned` values are never rejected — they simply
 * match nothing (RG-010-12).
 */
export class MergeRequestFilterQueryDto {
  /** `1` includes drafts after the Ready block. Defaults to `0` (RG-009-01). */
  @IsOptional()
  @IsIn(BOOLEAN_PARAMS)
  drafts?: BooleanParam;

  /** `1` restricts to merge requests where I have a role. Defaults to `0` (RG-009-02). */
  @IsOptional()
  @IsIn(BOOLEAN_PARAMS)
  mine?: BooleanParam;

  /** CSV of project aliases. */
  @IsOptional()
  @Transform(toArray)
  project?: string[];

  /** CSV of author usernames. */
  @IsOptional()
  @Transform(toArray)
  author?: string[];

  /** CSV of `'nobody'`/reviewer-or-assignee usernames (RG-G13). */
  @IsOptional()
  @Transform(toArray)
  assigned?: string[];

  /** `1`/`0`. Invalid values are rejected (400, RG-010-12), unlike the list params above. */
  @IsOptional()
  @IsIn(BOOLEAN_PARAMS)
  approved?: BooleanParam;

  /** `1`/`0`. Same validation as `approved`. */
  @IsOptional()
  @IsIn(BOOLEAN_PARAMS)
  commented?: BooleanParam;
}

/** Query params of `GET /api/v1/merge-requests` (RG-008-07 adds `sort` on top of the shared filters). */
export class MergeRequestQueryDto extends MergeRequestFilterQueryDto {
  /** `ready:asc|ready:desc|diff:asc|diff:desc`. Defaults to `ready:asc` when absent (RG-008-01). */
  @IsOptional()
  @IsIn(SORT_PARAMS)
  sort?: SortParam;
}

/** Query params of `GET /api/v1/merge-requests/facets` — same filters, no `sort` (RG-010-07). */
export class MergeRequestFacetsQueryDto extends MergeRequestFilterQueryDto {}
