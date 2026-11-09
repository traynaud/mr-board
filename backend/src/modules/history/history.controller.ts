import { Controller, Get, Query } from '@nestjs/common';
import { HistoryQueryDto } from './dto/history-query.dto.js';
import { HistoryResponseDto } from './dto/history-response.dto.js';
import { HistoryQueryService } from './history-query.service.js';

/** REST facade of the merge request history timeline (RG-037-*). */
@Controller('history')
export class HistoryController {
  constructor(private readonly historyQuery: HistoryQueryService) {}

  /** `GET /api/v1/history?limit=50&cursor=...` — newest events first. */
  @Get()
  list(@Query() query: HistoryQueryDto): Promise<HistoryResponseDto> {
    return this.historyQuery.list(query);
  }
}
