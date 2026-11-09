import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** Default and maximum page sizes of the timeline (RG-037-03). */
export const HISTORY_DEFAULT_LIMIT = 50;
export const HISTORY_MAX_LIMIT = 200;

/** Query params of `GET /api/v1/history`. */
export class HistoryQueryDto {
  /** Page size, 1–200 (default 50). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(HISTORY_MAX_LIMIT)
  limit?: number;

  /** Opaque cursor returned as `nextCursor` by the previous page. */
  @IsOptional()
  @IsString()
  cursor?: string;
}
