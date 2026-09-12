import { Controller, Get, Query } from '@nestjs/common';
import { MergeRequestQueryDto } from './dto/merge-request-query.dto';
import { MergeRequestsResponseDto } from './dto/merge-requests-response.dto';
import { MergeRequestsService } from './merge-requests.service';

/** REST facade of the synchronised merge requests (RG-005-*, RG-008-*, RG-009-*). */
@Controller('merge-requests')
export class MergeRequestsController {
  constructor(private readonly mergeRequestsService: MergeRequestsService) {}

  /** `GET /api/v1/merge-requests?sort=...&drafts=0|1&mine=0|1` */
  @Get()
  list(
    @Query() query: MergeRequestQueryDto,
  ): Promise<MergeRequestsResponseDto> {
    return this.mergeRequestsService.listOpen({
      sort: query.sort,
      includeDrafts: query.drafts === '1',
      mineOnly: query.mine === '1',
    });
  }
}
