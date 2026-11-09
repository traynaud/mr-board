import { HistoryEventDto } from '../../history/dto/history-response.dto.js';

/** Query params of `GET /api/v1/notifications` (RG-040-07). */
export const NOTIFICATIONS_DEFAULT_LIMIT = 50;

/** Cheap poll payload of `GET /api/v1/notifications/summary` (RG-040-05). */
export class NotificationsSummaryDto {
  /** Eligible, still unseen events (exact, never capped). */
  count!: number;
  /** Changes whenever the panel's content changes. */
  revision!: string;
}

/** Response of `GET /api/v1/notifications`. */
export class NotificationsResponseDto extends NotificationsSummaryDto {
  /** The most recent eligible events, newest first. */
  events!: HistoryEventDto[];
}

/** Response of `POST /api/v1/notifications/dismiss-all`. */
export class DismissAllResponseDto {
  dismissed!: number;
}
