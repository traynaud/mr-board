import { Controller, Get, Query } from '@nestjs/common';
import { HistoryQueryDto } from './dto/history-query.dto.js';
import {
  HistoryActorOptionDto,
  HistoryResponseDto,
} from './dto/history-response.dto.js';
import { HistoryQueryService } from './history-query.service.js';

/** REST facade of the merge request history timeline (RG-037-*). */
@Controller('history')
export class HistoryController {
  constructor(private readonly historyQuery: HistoryQueryService) {}

  /**
   * `GET /api/v1/history?limit=50&cursor=...&q=&type=&actor=&project=&from=&to=`
   * — newest events first, filtered (RG-038-*).
   */
  @Get()
  list(@Query() query: HistoryQueryDto): Promise<HistoryResponseDto> {
    return this.historyQuery.list(query);
  }

  /** `GET /api/v1/history/actors` — distinct actors for the « Acteur » filter (RG-038-07). */
  @Get('actors')
  listActors(): Promise<HistoryActorOptionDto[]> {
    return this.historyQuery.listActors();
  }
}
