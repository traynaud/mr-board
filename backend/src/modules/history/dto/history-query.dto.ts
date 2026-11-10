import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  HISTORY_EVENT_TYPES,
  type HistoryEventType,
} from '../entities/merge-request-event.entity.js';

/** Default and maximum page sizes of the timeline (RG-037-03). */
export const HISTORY_DEFAULT_LIMIT = 50;
export const HISTORY_MAX_LIMIT = 200;
/** Maximum number of values of a list filter. */
export const HISTORY_MAX_FILTER_VALUES = 100;
/** Maximum length of the search input (RG-038-05). */
export const HISTORY_MAX_SEARCH_LENGTH = 100;

/** `a,b` or repeated `?k=a&k=b` → `['a', 'b']`; blank items are dropped. */
function toList(value: unknown): unknown {
  const items: unknown[] = Array.isArray(value) ? value : [value];
  return items
    .flatMap((item) => (typeof item === 'string' ? item.split(',') : [item]))
    .filter((item) => item !== '');
}

/** Query params of `GET /api/v1/history` (RG-037-03, RG-038-*). */
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

  /** Title / number search (RG-038-05). */
  @IsOptional()
  @IsString()
  @MaxLength(HISTORY_MAX_SEARCH_LENGTH)
  q?: string;

  /** Event types, comma separated (OR). */
  @IsOptional()
  @Transform(({ value }) => toList(value))
  @IsArray()
  @ArrayMaxSize(HISTORY_MAX_FILTER_VALUES)
  @IsIn(HISTORY_EVENT_TYPES, { each: true })
  type?: HistoryEventType[];

  /** Actor usernames, comma separated (OR); `none` = unknown actor. */
  @IsOptional()
  @Transform(({ value }) => toList(value))
  @IsArray()
  @ArrayMaxSize(HISTORY_MAX_FILTER_VALUES)
  @IsString({ each: true })
  actor?: string[];

  /** Project ids, comma separated (OR). */
  @IsOptional()
  @Transform(({ value }) =>
    (toList(value) as unknown[]).map((item) =>
      typeof item === 'string' && /^\d+$/.test(item) ? Number(item) : item,
    ),
  )
  @IsArray()
  @ArrayMaxSize(HISTORY_MAX_FILTER_VALUES)
  @IsInt({ each: true })
  project?: number[];

  /** Start of the period (ISO instant, inclusive). */
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  /** End of the period (ISO instant, exclusive). */
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
}
