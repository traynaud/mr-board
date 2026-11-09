import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ForgeMergeRequest } from '../forges/types/forge-merge-request.js';
import { detectMergeRequestChanges } from './domain/detect-merge-request-changes.js';
import {
  MergeRequestSnapshot,
  snapshotFromForge,
} from './domain/merge-request-snapshot.js';
import { HistoryBaseline } from './entities/history-baseline.entity.js';
import { HistoryQueueEntry } from './entities/history-queue-entry.entity.js';
import { MergeRequestEvent } from './entities/merge-request-event.entity.js';

/** Safety margin applied before the previous synchronisation (clock drift, RG-034-04). */
export const ENRICHMENT_WINDOW_MARGIN_MS = 5 * 60_000;

/** The project fields the history needs (instantané dénormalisé, RG-033-02). */
export interface HistoryProject {
  id: number;
  connectionId: number;
  alias: string;
}

export interface RecordProjectChangesInput {
  project: HistoryProject;
  /** State stored *before* this synchronisation's upsert (`MergeRequestsService.getSnapshots`). */
  previous: MergeRequestSnapshot[];
  /** Open merge requests returned by the forge for this synchronisation. */
  incoming: ForgeMergeRequest[];
  /** ISO timestamp of the synchronisation; used as `occurred_at` and `detected_at` (RG-033-07). */
  detectedAt: string;
}

/**
 * Journals the differences between two synchronisations of a project
 * (US-033). Events are provisional (unknown actor, date = synchronisation,
 * RG-033-07); every changed merge request is queued once for forge
 * enrichment (RG-034-02, consumed by US-034).
 */
@Injectable()
export class HistoryService {
  constructor(
    @InjectRepository(HistoryBaseline)
    private readonly baselines: Repository<HistoryBaseline>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Detects and persists the changes of a project's merge requests
   * (RG-033-01 to RG-033-08). The first synchronisation of a project only
   * records its baseline and journals nothing (RG-033-05). Events and queue
   * entries are written in a single transaction (RG-033-06).
   */
  async recordProjectChanges(input: RecordProjectChangesInput): Promise<void> {
    const { project, previous, incoming, detectedAt } = input;

    if (!(await this.baselines.existsBy({ projectId: project.id }))) {
      await this.baselines.insert({
        projectId: project.id,
        baselinedAt: detectedAt,
      });
      return;
    }

    const previousByIid = new Map(previous.map((mr) => [mr.iid, mr]));
    const events: Partial<MergeRequestEvent>[] = [];
    const queue: Partial<HistoryQueueEntry>[] = [];

    for (const mergeRequest of incoming) {
      const snapshot = snapshotFromForge(mergeRequest);
      const { changes, needsEnrichment } = detectMergeRequestChanges(
        previousByIid.get(snapshot.iid) ?? null,
        snapshot,
      );
      for (const change of changes) {
        // `created` is exact without any forge call: the author and the
        // creation date are part of the payload (US-034, archi.md).
        const exact = change.type === 'created';
        events.push({
          occurredAt: exact ? mergeRequest.createdAt : detectedAt,
          detectedAt,
          type: change.type,
          status: exact ? 'confirmed' : 'provisional',
          sourceEventId: null,
          connectionId: project.connectionId,
          projectId: project.id,
          mrIid: snapshot.iid,
          mrTitle: snapshot.title,
          mrWebUrl: snapshot.webUrl,
          projectAlias: project.alias,
          actorUsername: exact ? mergeRequest.author.username : null,
          actorName: exact ? mergeRequest.author.name : null,
          actorAvatarUrl: exact ? mergeRequest.author.avatarUrl : null,
          oldValue: change.oldValue,
          newValue: change.newValue,
        });
      }
      if (needsEnrichment) {
        queue.push({
          projectId: project.id,
          mrIid: snapshot.iid,
          mrTitle: snapshot.title,
          mrWebUrl: snapshot.webUrl,
          requestedAt: detectedAt,
          since: windowStart(
            previousByIid.get(snapshot.iid),
            mergeRequest,
            detectedAt,
          ),
          attempts: 0,
          nextAttemptAt: null,
        });
      }
    }

    if (events.length === 0 && queue.length === 0) {
      return;
    }
    await this.dataSource.transaction(async (manager) => {
      if (events.length > 0) {
        await manager.insert(MergeRequestEvent, events);
      }
      if (queue.length > 0) {
        // A MR already waiting keeps its oldest window start (RG-034-02).
        const waiting = await manager.find(HistoryQueueEntry, {
          where: {
            projectId: project.id,
            mrIid: In(queue.map((entry) => entry.mrIid as number)),
          },
        });
        const waitingSince = new Map(
          waiting.map((entry) => [
            entry.mrIid,
            entry.since ?? entry.requestedAt,
          ]),
        );
        for (const entry of queue) {
          const existing = waitingSince.get(entry.mrIid as number);
          if (existing !== undefined && existing < (entry.since as string)) {
            entry.since = existing;
          }
        }
        await manager.upsert(HistoryQueueEntry, queue, ['projectId', 'mrIid']);
      }
    });
  }
}

/**
 * Start of the forge window to re-read for a merge request: the previous
 * synchronisation minus a margin; for a new one, its creation date.
 */
function windowStart(
  previous: MergeRequestSnapshot | undefined,
  mergeRequest: ForgeMergeRequest,
  detectedAt: string,
): string {
  if (!previous) {
    return mergeRequest.createdAt;
  }
  const reference = previous.syncedAt ?? detectedAt;
  return new Date(
    new Date(reference).getTime() - ENRICHMENT_WINDOW_MARGIN_MS,
  ).toISOString();
}
