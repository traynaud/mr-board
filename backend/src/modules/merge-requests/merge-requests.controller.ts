import { Controller, Get } from '@nestjs/common';
import { MergeRequestViewDto } from './dto/merge-request-view.dto';
import { MergeRequestsService } from './merge-requests.service';

/** REST facade of the synchronised merge requests (RG-005-*). */
@Controller('merge-requests')
export class MergeRequestsController {
  constructor(private readonly mergeRequestsService: MergeRequestsService) {}

  /** `GET /api/v1/merge-requests` */
  @Get()
  list(): Promise<MergeRequestViewDto[]> {
    return this.mergeRequestsService.listOpen();
  }
}
