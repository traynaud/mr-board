import {
  Controller,
  Get,
  HttpCode,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { SyncStatusResponseDto } from './dto/sync-status-response.dto.js';
import { SyncTriggerResponseDto } from './dto/sync-trigger-response.dto.js';
import { SyncService } from './sync.service.js';

/** REST facade of the GitLab synchronisation (RG-004-*). */
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  /**
   * `POST /api/v1/sync` — starts (or reports) a synchronisation. Always
   * returns 202 with `{ running: true }` (RG-004-05); GitLab failures are
   * captured in `sync_runs`, not returned as an HTTP error.
   */
  @Post()
  @HttpCode(202)
  trigger(
    @Query('projectId', new ParseIntPipe({ optional: true }))
    projectId?: number,
  ): Promise<SyncTriggerResponseDto> {
    return this.syncService.trigger('manual', projectId);
  }

  /** `GET /api/v1/sync/status` */
  @Get('status')
  getStatus(): Promise<SyncStatusResponseDto> {
    return this.syncService.getStatus();
  }
}
