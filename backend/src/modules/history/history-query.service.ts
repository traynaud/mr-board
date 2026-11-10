import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { BusinessValidationException } from '../../common/exceptions/index.js';
import {
  decodeCursor,
  encodeCursor,
  HistoryCursor,
} from './domain/history-cursor.js';
import {
  buildHistoryFilter,
  HistoryFilter,
  SQL_FOLD_FUNCTION,
  toLikePattern,
} from './domain/history-filter.js';
import {
  HISTORY_DEFAULT_LIMIT,
  HistoryQueryDto,
} from './dto/history-query.dto.js';
import {
  HistoryActorOptionDto,
  HistoryEventDto,
  HistoryResponseDto,
  HistoryValueDto,
} from './dto/history-response.dto.js';
import { MergeRequestEvent } from './entities/merge-request-event.entity.js';

/** Read side of the history: the paginated, filterable timeline (US-037, US-038). */
@Injectable()
export class HistoryQueryService {
  constructor(
    @InjectRepository(MergeRequestEvent)
    private readonly events: Repository<MergeRequestEvent>,
  ) {}

  /**
   * Returns one page of the timeline, newest first (RG-037-01/03), restricted to the
   * requested filters (RG-038-*); `total` counts every event matching the filters.
   * @throws BusinessValidationException `history.cursor.invalid` when the cursor cannot be decoded,
   * `history.filter.period.invalid` when the period is inverted.
   */
  async list(query: HistoryQueryDto): Promise<HistoryResponseDto> {
    const limit = query.limit ?? HISTORY_DEFAULT_LIMIT;
    const filter = buildHistoryFilter(query);
    let cursor: HistoryCursor | null = null;
    if (query.cursor !== undefined) {
      cursor = decodeCursor(query.cursor);
      if (!cursor) {
        throw new BusinessValidationException(
          'history.cursor.invalid',
          'The history cursor is invalid',
        );
      }
    }

    const page = this.applyFilter(this.events.createQueryBuilder('e'), filter)
      .orderBy('e.occurredAt', 'DESC')
      .addOrderBy('e.id', 'DESC')
      .take(limit + 1);
    if (cursor) {
      page.andWhere(
        new Brackets((qb) =>
          qb.where(
            'e.occurred_at < :at OR (e.occurred_at = :at AND e.id < :id)',
            { at: cursor.occurredAt, id: cursor.id },
          ),
        ),
      );
    }

    const [rows, total] = await Promise.all([
      page.getMany(),
      this.applyFilter(this.events.createQueryBuilder('e'), filter).getCount(),
    ]);
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const last = pageRows[pageRows.length - 1];
    return {
      events: pageRows.map(toEventDto),
      nextCursor:
        hasMore && last
          ? encodeCursor({ occurredAt: last.occurredAt, id: last.id })
          : null,
      total,
    };
  }

  /**
   * Distinct actors present in the history, sorted by name then username (RG-038-07).
   * Events without actor are not listed (the « unknown » option is added by the client).
   */
  async listActors(): Promise<HistoryActorOptionDto[]> {
    const rows = await this.events
      .createQueryBuilder('e')
      .select('e.actor_username', 'username')
      .addSelect('MAX(e.actor_name)', 'name')
      .addSelect('MAX(e.actor_avatar_url)', 'avatarUrl')
      .where('e.actor_username IS NOT NULL')
      .groupBy('e.actor_username')
      .getRawMany<{
        username: string;
        name: string | null;
        avatarUrl: string | null;
      }>();
    return rows.sort((a, b) =>
      (a.name ?? a.username).localeCompare(b.name ?? b.username, 'en', {
        sensitivity: 'base',
      }),
    );
  }

  /** Adds the WHERE clauses of `filter` (AND between filters, OR inside one, RG-038-02). */
  private applyFilter(
    qb: SelectQueryBuilder<MergeRequestEvent>,
    filter: HistoryFilter,
  ): SelectQueryBuilder<MergeRequestEvent> {
    if (filter.terms.length > 0) {
      const params: Record<string, string | number> = {};
      const title = filter.terms
        .map((term, index) => {
          params[`term${index}`] = toLikePattern(term);
          return `${SQL_FOLD_FUNCTION}(e.mr_title) LIKE :term${index} ESCAPE '\\'`;
        })
        .join(' AND ');
      if (filter.iid !== null) {
        params['iid'] = filter.iid;
      }
      qb.andWhere(
        filter.iid !== null ? `((${title}) OR e.mr_iid = :iid)` : `(${title})`,
        params,
      );
    }
    if (filter.types.length > 0) {
      qb.andWhere('e.type IN (:...types)', { types: filter.types });
    }
    if (filter.actors.length > 0 || filter.includeUnknownActor) {
      qb.andWhere(
        new Brackets((actors) => {
          if (filter.actors.length > 0) {
            actors.where('e.actor_username IN (:...actors)', {
              actors: filter.actors,
            });
          }
          if (filter.includeUnknownActor) {
            actors.orWhere('e.actor_username IS NULL');
          }
        }),
      );
    }
    if (filter.projectIds.length > 0) {
      qb.andWhere('e.project_id IN (:...projectIds)', {
        projectIds: filter.projectIds,
      });
    }
    if (filter.from !== null) {
      qb.andWhere('e.occurred_at >= :from', { from: filter.from });
    }
    if (filter.to !== null) {
      qb.andWhere('e.occurred_at < :to', { to: filter.to });
    }
    return qb;
  }
}

export function toEventDto(event: MergeRequestEvent): HistoryEventDto {
  const hasActor =
    event.actorUsername !== null ||
    event.actorName !== null ||
    event.actorAvatarUrl !== null;
  return {
    id: event.id,
    occurredAt: event.occurredAt,
    type: event.type,
    status: event.status,
    projectId: event.projectId,
    projectAlias: event.projectAlias,
    mrIid: event.mrIid,
    mrTitle: event.mrTitle,
    mrWebUrl: event.mrWebUrl,
    actor: hasActor
      ? {
          username: event.actorUsername,
          name: event.actorName,
          avatarUrl: event.actorAvatarUrl,
        }
      : null,
    oldValue: parseValue(event.oldValue),
    newValue: parseValue(event.newValue),
  };
}

/** Deserialises a stored JSON value; falls back to the raw text when unparsable. */
function parseValue(raw: string | null): HistoryValueDto {
  if (raw === null) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value === 'string' || typeof value === 'boolean') {
      return value;
    }
    if (
      typeof value === 'object' &&
      value !== null &&
      'username' in value &&
      'name' in value &&
      typeof value.username === 'string' &&
      typeof value.name === 'string'
    ) {
      return { username: value.username, name: value.name };
    }
    return raw;
  } catch {
    return raw;
  }
}
