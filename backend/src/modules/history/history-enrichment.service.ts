import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { ConnectionsService } from '../connections/connections.service.js';
import { ForgeClientFactory } from '../forges/forge-client.factory.js';
import { ProjectsService } from '../projects/projects.service.js';
import { computeRetryDelayMs } from './domain/compute-retry-delay.js';
import { buildTerminalEvent } from './domain/build-terminal-event.js';
import { reconcileEvents } from './domain/reconcile-events.js';
import { HistoryQueueEntry } from './entities/history-queue-entry.entity.js';
import { MergeRequestEvent } from './entities/merge-request-event.entity.js';

/** Entries processed in parallel (RG-034-03). */
export const ENRICHMENT_CONCURRENCY = 2;

/** Safety cap on the entries handled by one run. */
export const ENRICHMENT_MAX_PER_RUN = 50;

/** Time budget of one forge call (ms). */
export const ENRICHMENT_CALL_TIMEOUT_MS = 60_000;

/**
 * Consumes the history queue (US-034): for each merge request, reads what
 * really happened on the forge, confirms the provisional events and creates
 * the missing ones (RG-034-04). Never throws: a failure is retried with a
 * growing delay, then abandoned (RG-034-07).
 */
@Injectable()
export class HistoryEnrichmentService {
  private readonly logger = new Logger(HistoryEnrichmentService.name);
  private running = false;

  constructor(
    @InjectRepository(HistoryQueueEntry)
    private readonly queue: Repository<HistoryQueueEntry>,
    @InjectRepository(MergeRequestEvent)
    private readonly events: Repository<MergeRequestEvent>,
    private readonly dataSource: DataSource,
    private readonly projects: ProjectsService,
    private readonly connections: ConnectionsService,
    private readonly forges: ForgeClientFactory,
  ) {}

  /**
   * Processes the due entries, oldest request first, a couple at a time.
   * Only one run at a time (a concurrent call returns immediately).
   * @returns the number of entries handled (success or failure).
   */
  async processDue(now: Date = new Date()): Promise<number> {
    if (this.running) {
      return 0;
    }
    this.running = true;
    let handled = 0;
    try {
      while (handled < ENRICHMENT_MAX_PER_RUN) {
        const batch = await this.queue.find({
          where: [
            { nextAttemptAt: IsNull() },
            { nextAttemptAt: LessThanOrEqual(now.toISOString()) },
          ],
          order: { requestedAt: 'ASC', id: 'ASC' },
          take: ENRICHMENT_CONCURRENCY,
        });
        if (batch.length === 0) {
          break;
        }
        await Promise.all(batch.map((entry) => this.processEntry(entry, now)));
        handled += batch.length;
      }
    } finally {
      this.running = false;
    }
    return handled;
  }

  private async processEntry(
    entry: HistoryQueueEntry,
    now: Date,
  ): Promise<void> {
    try {
      await this.enrich(entry);
    } catch (error) {
      await this.recordFailure(entry, now, error);
    }
  }

  private async enrich(entry: HistoryQueueEntry): Promise<void> {
    const project = await this.projects.findById(entry.projectId);
    if (!project) {
      await this.queue.delete({ id: entry.id });
      return;
    }
    const connection = await this.connections.findOrThrow(project.connectionId);
    const token = await this.connections.getToken(connection.id);
    if (!token) {
      throw new Error('connection has no token');
    }
    const since = entry.since ?? entry.requestedAt;
    const forge = this.forges.forType(connection.type);
    const forgeProject = {
      remoteProjectId: project.remoteProjectId,
      pathWithNamespace: project.pathWithNamespace,
      webUrl: project.webUrl,
    };
    const forgeEvents = await forge.fetchMergeRequestEvents(
      connection.url,
      token,
      forgeProject,
      entry.mrIid,
      { since, deadlineAt: Date.now() + ENRICHMENT_CALL_TIMEOUT_MS },
    );
    // RG-035-02: a merge request that left the open list — look up its final state.
    const terminal =
      entry.kind === 'disappeared'
        ? buildTerminalEvent(
            await forge.fetchMergeRequestState(
              connection.url,
              token,
              forgeProject,
              entry.mrIid,
              { deadlineAt: Date.now() + ENRICHMENT_CALL_TIMEOUT_MS },
            ),
            entry,
          )
        : null;

    const provisional = await this.events.find({
      where: {
        projectId: entry.projectId,
        mrIid: entry.mrIid,
        status: 'provisional',
      },
    });
    const sourceIds = forgeEvents.map((event) => event.sourceEventId);
    const known =
      sourceIds.length === 0
        ? []
        : await this.events.find({
            select: { sourceEventId: true },
            where: {
              connectionId: connection.id,
              sourceEventId: In(sourceIds),
            },
          });
    const { updates, inserts } = reconcileEvents(
      provisional,
      forgeEvents,
      new Set(known.map((row) => row.sourceEventId as string)),
    );
    if (terminal) {
      inserts.push(terminal);
    }

    const detectedAt = new Date().toISOString();
    await this.dataSource.transaction(async (manager) => {
      for (const { id, ...patch } of updates) {
        await manager.update(MergeRequestEvent, id, {
          ...patch,
          status: 'confirmed',
        });
      }
      if (inserts.length > 0) {
        await manager
          .createQueryBuilder()
          .insert()
          .into(MergeRequestEvent)
          .values(
            inserts.map((event) => ({
              occurredAt: event.occurredAt,
              detectedAt,
              type: event.type,
              status: 'confirmed' as const,
              sourceEventId: event.sourceEventId,
              connectionId: connection.id,
              projectId: project.id,
              mrIid: entry.mrIid,
              mrTitle: entry.mrTitle,
              mrWebUrl: entry.mrWebUrl,
              projectAlias: project.alias,
              actorUsername: event.actor?.username ?? null,
              actorName: event.actor?.name ?? null,
              actorAvatarUrl: event.actor?.avatarUrl ?? null,
              oldValue: event.oldValue,
              newValue: event.newValue,
            })),
          )
          .orIgnore()
          .execute();
      }
      // A trigger received while this entry was processed keeps it queued.
      await manager.delete(HistoryQueueEntry, {
        id: entry.id,
        requestedAt: entry.requestedAt,
      });
    });
  }

  /**
   * Gives up on an entry (RG-034-07). A merge request that vanished still
   * leaves a trace: a provisional `disappeared` event (RG-035-04 repli).
   */
  private async abandon(entry: HistoryQueueEntry, now: Date): Promise<void> {
    const project =
      entry.kind === 'disappeared'
        ? await this.projects.findById(entry.projectId)
        : null;
    await this.dataSource.transaction(async (manager) => {
      if (project) {
        const at = now.toISOString();
        await manager
          .createQueryBuilder()
          .insert()
          .into(MergeRequestEvent)
          .values({
            occurredAt: entry.requestedAt,
            detectedAt: at,
            type: 'disappeared',
            status: 'provisional',
            sourceEventId: `disappeared:${entry.mrIid}:${entry.requestedAt}`,
            connectionId: project.connectionId,
            projectId: project.id,
            mrIid: entry.mrIid,
            mrTitle: entry.mrTitle,
            mrWebUrl: entry.mrWebUrl,
            projectAlias: project.alias,
            actorUsername: null,
            actorName: null,
            actorAvatarUrl: null,
            oldValue: JSON.stringify('opened'),
            newValue: null,
          })
          .orIgnore()
          .execute();
      }
      await manager.delete(HistoryQueueEntry, {
        id: entry.id,
        requestedAt: entry.requestedAt,
      });
    });
  }

  private async recordFailure(
    entry: HistoryQueueEntry,
    now: Date,
    error: unknown,
  ): Promise<void> {
    const attempts = entry.attempts + 1;
    const delay = computeRetryDelayMs(attempts);
    const reason = error instanceof Error ? error.name : String(error);
    try {
      if (delay === null) {
        this.logger.warn(
          `History enrichment abandoned for MR !${entry.mrIid} (project ${entry.projectId}) after ${attempts} attempts: ${reason}`,
        );
        await this.abandon(entry, now);
        return;
      }
      this.logger.warn(
        `History enrichment failed for MR !${entry.mrIid} (project ${entry.projectId}), attempt ${attempts}: ${reason}`,
      );
      await this.queue.update(
        { id: entry.id, requestedAt: entry.requestedAt },
        {
          attempts,
          nextAttemptAt: new Date(now.getTime() + delay).toISOString(),
        },
      );
    } catch (persistError) {
      this.logger.error(
        `History queue bookkeeping failed: ${persistError instanceof Error ? persistError.name : String(persistError)}`,
      );
    }
  }
}
