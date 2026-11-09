import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessValidationException } from '../../common/exceptions/index.js';
import {
  decodeCursor,
  encodeCursor,
  HistoryCursor,
} from './domain/history-cursor.js';
import {
  HISTORY_DEFAULT_LIMIT,
  HistoryQueryDto,
} from './dto/history-query.dto.js';
import {
  HistoryEventDto,
  HistoryResponseDto,
  HistoryValueDto,
} from './dto/history-response.dto.js';
import { MergeRequestEvent } from './entities/merge-request-event.entity.js';

/** Read side of the history: the paginated timeline (US-037). */
@Injectable()
export class HistoryQueryService {
  constructor(
    @InjectRepository(MergeRequestEvent)
    private readonly events: Repository<MergeRequestEvent>,
  ) {}

  /**
   * Returns one page of the timeline, newest first (RG-037-01/03).
   * @throws BusinessValidationException `history.cursor.invalid` when the cursor cannot be decoded.
   */
  async list(query: HistoryQueryDto): Promise<HistoryResponseDto> {
    const limit = query.limit ?? HISTORY_DEFAULT_LIMIT;
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

    const page = this.events
      .createQueryBuilder('e')
      .orderBy('e.occurredAt', 'DESC')
      .addOrderBy('e.id', 'DESC')
      .take(limit + 1);
    if (cursor) {
      page.where(
        'e.occurred_at < :at OR (e.occurred_at = :at AND e.id < :id)',
        { at: cursor.occurredAt, id: cursor.id },
      );
    }

    const [rows, total] = await Promise.all([
      page.getMany(),
      this.events.count(),
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
