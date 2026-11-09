import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { NotificationsQueryDto } from './dto/notifications-query.dto.js';
import {
  DismissAllResponseDto,
  NotificationsResponseDto,
  NotificationsSummaryDto,
} from './dto/notifications-response.dto.js';
import { NotificationsService } from './notifications.service.js';

/** REST facade of the notifications panel (RG-039-* to RG-041-*). */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /** `GET /api/v1/notifications?limit=50` — unseen eligible events, newest first. */
  @Get()
  list(
    @Query() query: NotificationsQueryDto,
  ): Promise<NotificationsResponseDto> {
    return this.notifications.list(query.limit);
  }

  /** `GET /api/v1/notifications/summary` — count and revision token. */
  @Get('summary')
  summary(): Promise<NotificationsSummaryDto> {
    return this.notifications.summary();
  }

  /** `POST /api/v1/notifications/dismiss-all` — marks every eligible event as seen. */
  @Post('dismiss-all')
  @HttpCode(200)
  dismissAll(): Promise<DismissAllResponseDto> {
    return this.notifications.dismissAll();
  }

  /** `POST /api/v1/notifications/:id/dismiss` — marks one event as seen (idempotent). */
  @Post(':id/dismiss')
  @HttpCode(204)
  async dismiss(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.notifications.dismiss(id);
  }
}
