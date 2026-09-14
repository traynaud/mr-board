import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Put,
  Query,
} from '@nestjs/common';
import { ComposableFilters } from './domain/filter-merge-requests';
import {
  MergeRequestFacetsQueryDto,
  MergeRequestFilterQueryDto,
  MergeRequestQueryDto,
} from './dto/merge-request-query.dto';
import { MergeRequestsFacetsDto } from './dto/merge-requests-facets.dto';
import { MergeRequestsResponseDto } from './dto/merge-requests-response.dto';
import { MergeRequestsService } from './merge-requests.service';

/** REST facade of the synchronised merge requests (RG-005-*, RG-008-*, RG-009-*, RG-010-*, RG-027-*). */
@Controller('merge-requests')
export class MergeRequestsController {
  constructor(private readonly mergeRequestsService: MergeRequestsService) {}

  /** `GET /api/v1/merge-requests?sort=...&drafts=0|1&mine=0|1&fav=0|1&connection=...&project=...&author=...&assigned=...&approved=0|1&commented=0|1&q=...` */
  @Get()
  list(
    @Query() query: MergeRequestQueryDto,
  ): Promise<MergeRequestsResponseDto> {
    return this.mergeRequestsService.listOpen({
      sort: query.sort,
      includeDrafts: query.drafts === '1',
      mineOnly: query.mine === '1',
      favoritesOnly: query.fav === '1',
      filters: toComposableFilters(query),
      search: query.q,
    });
  }

  /** `GET /api/v1/merge-requests/facets` — same filter params as above, no `sort` (RG-010-07). */
  @Get('facets')
  facets(
    @Query() query: MergeRequestFacetsQueryDto,
  ): Promise<MergeRequestsFacetsDto> {
    return this.mergeRequestsService.getFacets({
      includeDrafts: query.drafts === '1',
      mineOnly: query.mine === '1',
      favoritesOnly: query.fav === '1',
      filters: toComposableFilters(query),
      search: query.q,
    });
  }

  /** `PUT /api/v1/merge-requests/:id/favorite` — marks a merge request as favorite (RG-027-08). */
  @Put(':id/favorite')
  @HttpCode(HttpStatus.NO_CONTENT)
  markFavorite(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.mergeRequestsService.setFavorite(id, true);
  }

  /** `DELETE /api/v1/merge-requests/:id/favorite` — unmarks a merge request as favorite (RG-027-08). */
  @Delete(':id/favorite')
  @HttpCode(HttpStatus.NO_CONTENT)
  unmarkFavorite(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.mergeRequestsService.setFavorite(id, false);
  }
}

/** Maps the shared filter query params to the domain's `ComposableFilters` (RG-010-01/12). */
function toComposableFilters(
  query: MergeRequestFilterQueryDto,
): ComposableFilters {
  return {
    connection: query.connection ?? [],
    project: query.project ?? [],
    author: query.author ?? [],
    assigned: query.assigned ?? [],
    approved: toYesNo(query.approved),
    commented: toYesNo(query.commented),
  };
}

function toYesNo(value: '0' | '1' | undefined): 'yes' | 'no' | null {
  if (value === undefined) {
    return null;
  }
  return value === '1' ? 'yes' : 'no';
}
