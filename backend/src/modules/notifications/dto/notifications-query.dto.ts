import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { NOTIFICATIONS_DEFAULT_LIMIT } from './notifications-response.dto.js';

/** Max number of events listed by the panel (RG-040-07). */
export const NOTIFICATIONS_MAX_LIMIT = NOTIFICATIONS_DEFAULT_LIMIT;

/** Query params of `GET /api/v1/notifications`. */
export class NotificationsQueryDto {
  /** Page size, 1–50 (default 50). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(NOTIFICATIONS_MAX_LIMIT)
  limit?: number;
}
