import { Controller, Get, Query } from '@nestjs/common';
import { MergeRequestQueryDto } from './dto/merge-request-query.dto';
import { MergeRequestViewDto } from './dto/merge-request-view.dto';
import { MergeRequestsService } from './merge-requests.service';

/** REST facade of the synchronised merge requests (RG-005-*, RG-008-*). */
@Controller('merge-requests')
export class MergeRequestsController {
  constructor(private readonly mergeRequestsService: MergeRequestsService) {}

  /** `GET /api/v1/merge-requests?sort=ready:asc|ready:desc|diff:asc|diff:desc` */
  @Get()
  list(@Query() query: MergeRequestQueryDto): Promise<MergeRequestViewDto[]> {
    return this.mergeRequestsService.listOpen(query.sort);
  }
}
