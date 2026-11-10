import type {
  HistoryEventStatus,
  HistoryEventType,
} from '../entities/merge-request-event.entity.js';

/** Author of an event, as seen by the forge (`null` when unknown, RG-037-05). */
export class HistoryActorDto {
  username!: string | null;
  name!: string | null;
  avatarUrl!: string | null;
}

/** A deserialised old/new value: text, boolean (draft) or a user reference. */
export type HistoryValueDto =
  string | boolean | { username: string; name: string } | null;

/** One timeline entry (RG-037-02). */
export class HistoryEventDto {
  id!: number;
  occurredAt!: string;
  type!: HistoryEventType;
  status!: HistoryEventStatus;
  projectId!: number;
  projectAlias!: string;
  mrIid!: number;
  mrTitle!: string;
  mrWebUrl!: string;
  actor!: HistoryActorDto | null;
  oldValue!: HistoryValueDto;
  newValue!: HistoryValueDto;
}

/** Response of `GET /api/v1/history`. */
export class HistoryResponseDto {
  events!: HistoryEventDto[];
  /** `null` on the last page. */
  nextCursor!: string | null;
  /** Number of events matching the query, all pages included. */
  total!: number;
}

/** One selectable actor of the « Acteur » filter (RG-038-07). */
export class HistoryActorOptionDto {
  username!: string;
  name!: string | null;
  avatarUrl!: string | null;
}
