import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { EntityNotFoundException } from '../../common/exceptions/index.js';
import { ConnectionsService } from '../connections/connections.service.js';
import { toEventDto } from '../history/history-query.service.js';
import { MergeRequestEvent } from '../history/entities/merge-request-event.entity.js';
import { SettingsService } from '../settings/settings.service.js';
import {
  buildRevision,
  NotificationFilter,
} from './domain/notification-filter.js';
import { NOTIFICATIONS_MAX_LIMIT } from './dto/notifications-query.dto.js';
import {
  DismissAllResponseDto,
  NotificationsResponseDto,
  NotificationsSummaryDto,
} from './dto/notifications-response.dto.js';

/** A resolved identity of mine, lower-cased, on one connection. */
interface Identity {
  connectionId: number;
  username: string;
}

/**
 * The notifications panel (US-039/040/041): journal events not yet marked as
 * seen, restricted by the notification preferences. A notification **is** a
 * `merge_request_events` row, so a provisional event confirmed in place, a
 * purged event or a deleted provisional one are reflected for free.
 */
@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(MergeRequestEvent)
    private readonly events: Repository<MergeRequestEvent>,
    private readonly settings: SettingsService,
    private readonly connections: ConnectionsService,
  ) {}

  /**
   * The most recent eligible events plus the exact count and the revision
   * token (RG-040-01/03/05/07).
   */
  async list(
    limit: number = NOTIFICATIONS_MAX_LIMIT,
  ): Promise<NotificationsResponseDto> {
    const [rows, summary] = await Promise.all([
      (await this.eligible())
        .orderBy('e.occurred_at', 'DESC')
        .addOrderBy('e.id', 'DESC')
        .take(limit)
        .getMany(),
      this.summary(),
    ]);
    return { events: rows.map(toEventDto), ...summary };
  }

  /** Count and revision token only, for cheap polling (RG-040-05). */
  async summary(): Promise<NotificationsSummaryDto> {
    const raw = await (
      await this.eligible()
    )
      .select('MAX(e.id)', 'maxId')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        `COALESCE(SUM(CASE WHEN e.status = 'provisional' THEN 1 ELSE 0 END), 0)`,
        'provisional',
      )
      .getRawOne<{
        maxId: number | null;
        total: number | string;
        provisional: number | string;
      }>();
    const count = Number(raw?.total ?? 0);
    return {
      count,
      revision: buildRevision(
        Number(raw?.maxId ?? 0),
        count,
        Number(raw?.provisional ?? 0),
      ),
    };
  }

  /**
   * Marks one event as seen (RG-040-02). Idempotent.
   * @throws EntityNotFoundException when the event does not exist (404).
   */
  async dismiss(id: number): Promise<void> {
    if (!(await this.events.existsBy({ id }))) {
      throw new EntityNotFoundException('Event', id);
    }
    await this.events
      .createQueryBuilder()
      .update(MergeRequestEvent)
      .set({ dismissedAt: new Date().toISOString() })
      .where('id = :id AND dismissed_at IS NULL', { id })
      .execute();
  }

  /**
   * Marks **every** eligible event as seen, beyond the 50 listed (RG-040-02).
   * A single statement: an event created meanwhile stays to handle.
   */
  async dismissAll(): Promise<DismissAllResponseDto> {
    const ids = (await this.eligible()).select('e.id');
    const result = await this.events
      .createQueryBuilder()
      .update(MergeRequestEvent)
      .set({ dismissedAt: new Date().toISOString() })
      .where(`id IN (${ids.getQuery()})`)
      .setParameters(ids.getParameters())
      .execute();
    return { dismissed: result.affected ?? 0 };
  }

  /** Unseen events matching the preferences (same rule as `isEligible`). */
  private async eligible(): Promise<SelectQueryBuilder<MergeRequestEvent>> {
    const [prefs, connections] = await Promise.all([
      this.settings.getNotificationPreferences(),
      this.connections.listIdentities(),
    ]);
    const identities: Identity[] = connections.map((identity) => ({
      connectionId: identity.connectionId,
      username: identity.username.toLowerCase(),
    }));
    return applyEligibility(this.events.createQueryBuilder('e'), identities, {
      disabledTypes: prefs.notifDisabledTypes,
      onlyMine: prefs.notifOnlyMine,
      excludeOwn: prefs.notifExcludeOwn,
    });
  }
}

/** Adds the eligibility conditions (RG-040-01, RG-041-*) to a query on alias `e`. */
function applyEligibility(
  query: SelectQueryBuilder<MergeRequestEvent>,
  identities: Identity[],
  filter: NotificationFilter,
): SelectQueryBuilder<MergeRequestEvent> {
  query.where('e.dismissed_at IS NULL');
  if (filter.disabledTypes.length > 0) {
    query.andWhere('e.type NOT IN (:...disabledTypes)', {
      disabledTypes: filter.disabledTypes,
    });
  }
  const params: Record<string, string | number> = {};
  if (filter.excludeOwn && identities.length > 0) {
    const mine = identities.map((identity, i) => {
      params[`ownConn${i}`] = identity.connectionId;
      params[`ownUser${i}`] = identity.username;
      return `(e.connection_id = :ownConn${i} AND lower(e.actor_username) = :ownUser${i})`;
    });
    query.andWhere(
      `NOT (e.actor_username IS NOT NULL AND (${mine.join(' OR ')}))`,
    );
  }
  if (filter.onlyMine) {
    if (identities.length === 0) {
      query.andWhere('1 = 0');
    } else {
      const mine = identities.map((identity, i) => {
        params[`mineConn${i}`] = identity.connectionId;
        params[`mineUser${i}`] = identity.username;
        return `(e.connection_id = :mineConn${i} AND EXISTS (SELECT 1 FROM json_each(e.mr_involved_usernames) j WHERE lower(j.value) = :mineUser${i}))`;
      });
      query.andWhere(`(${mine.join(' OR ')})`);
    }
  }
  return query.setParameters(params);
}
