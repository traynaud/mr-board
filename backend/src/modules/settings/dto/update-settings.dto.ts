import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  HISTORY_EVENT_TYPES,
  type HistoryEventType,
} from '../../history/entities/merge-request-event.entity.js';
import type { Language, ThemePreference } from '../entities/settings.entity.js';

/** RG-036-03 : bounds of the history retention settings. */
export const HISTORY_RETENTION_DAYS_MIN = 1;
export const HISTORY_RETENTION_DAYS_MAX = 365;
export const HISTORY_MAX_EVENTS_MIN = 100;
export const HISTORY_MAX_EVENTS_MAX = 100_000;

/** RG-013-01 : `0` = manual, no other value is accepted. */
export const REFRESH_INTERVAL_OPTIONS = [0, 1, 5, 15, 30] as const;

/** RG-018-01 : the only accepted values for the theme preference. */
export const THEME_OPTIONS = ['system', 'light', 'dark'] as const;

/** RG-022-01 : the only accepted values for the UI language preference. */
export const LANGUAGE_OPTIONS = ['fr', 'en'] as const;

/**
 * Reads the raw client-submitted value instead of the one already coerced by
 * `enableImplicitConversion` (`app.setup.ts`), which turns any truthy value
 * (`"false"`, `"yes"`, `1`…) into `true` before `@IsBoolean()` runs. Applied
 * to every boolean field so non-boolean input is rejected with 400 instead
 * of being silently stored as `true`.
 */
const rawBoolean = ({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): unknown => obj[key];

/**
 * Body of `PUT /api/v1/settings` — global preferences only (RG-019-23); my
 * identity is resolved automatically per connection from its token
 * (RG-031-02) and never carried by this body.
 */
export class UpdateSettingsDto {
  /** Scheduled sync cadence in minutes ; `0` = manual (RG-013-01). */
  @IsOptional()
  @IsIn(REFRESH_INTERVAL_OPTIONS)
  refreshIntervalMin?: number;

  /** Suspend frontend polling/reload while the tab is hidden (RG-013-05). */
  @Transform(rawBoolean)
  @IsOptional()
  @IsBoolean()
  pauseWhenHidden?: boolean;

  /** Difficulty thresholds (RG-G03, RG-014-01). Cross-field coherence is checked by `SettingsService`. */
  @IsOptional()
  @IsInt()
  @Min(1)
  easyFiles?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  easyLines?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  hardFiles?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  hardLines?: number;

  /** Ready delay thresholds in days (RG-G04, RG-014-01). Cross-field coherence is checked by `SettingsService`. */
  @IsOptional()
  @IsInt()
  @Min(0)
  readyGreenDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  readyOrangeDays?: number;

  /** Count only Monday-Friday for the Ready delay (RG-G04, RG-014-01). */
  @Transform(rawBoolean)
  @IsOptional()
  @IsBoolean()
  workdaysOnly?: boolean;

  /** Open MR titles in a new tab (RG-G11, RG-015-01). */
  @Transform(rawBoolean)
  @IsOptional()
  @IsBoolean()
  openInNewTab?: boolean;

  /** Labels that hide a merge request, compared case-insensitively (RG-015-02). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ignoredLabels?: string[];

  /** Browser notification when a merge request is newly assigned to me (RG-016-01/02). */
  @Transform(rawBoolean)
  @IsOptional()
  @IsBoolean()
  notifyAssigned?: boolean;

  /** Tab title badge counting red Ready-level merge requests (RG-016-04). */
  @Transform(rawBoolean)
  @IsOptional()
  @IsBoolean()
  tabBadge?: boolean;

  /** Theme preference (RG-018-01) : `system` follows the OS, `light`/`dark` force it. */
  @IsOptional()
  @IsIn(THEME_OPTIONS)
  theme?: ThemePreference;

  /** Highlight my avatar (author/reviewer/assignee) in the merge requests table (RG-023-01). */
  @Transform(rawBoolean)
  @IsOptional()
  @IsBoolean()
  highlightMe?: boolean;

  /** UI language preference (RG-022-01). */
  @IsOptional()
  @IsIn(LANGUAGE_OPTIONS)
  language?: Language;

  /** History retention in days (RG-036-01/03). */
  @IsOptional()
  @IsInt()
  @Min(HISTORY_RETENTION_DAYS_MIN)
  @Max(HISTORY_RETENTION_DAYS_MAX)
  historyRetentionDays?: number;

  /** History retention in number of events (RG-036-01/03). */
  @IsOptional()
  @IsInt()
  @Min(HISTORY_MAX_EVENTS_MIN)
  @Max(HISTORY_MAX_EVENTS_MAX)
  historyMaxEvents?: number;

  /** Event types hidden from the notifications panel (RG-041-01/02). */
  @IsOptional()
  @IsArray()
  @IsIn(HISTORY_EVENT_TYPES, { each: true })
  notifDisabledTypes?: HistoryEventType[];

  /** Notifications limited to the merge requests that concern me (RG-041-06). */
  @Transform(rawBoolean)
  @IsOptional()
  @IsBoolean()
  notifOnlyMine?: boolean;

  /** Notifications hide the events I caused myself (RG-041-06). */
  @Transform(rawBoolean)
  @IsOptional()
  @IsBoolean()
  notifExcludeOwn?: boolean;
}
