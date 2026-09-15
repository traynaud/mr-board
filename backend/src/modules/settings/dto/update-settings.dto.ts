import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type { Language, ThemePreference } from '../entities/settings.entity';
import { IdentityDto } from './identity.dto';

/** RG-013-01 : `0` = manual, no other value is accepted. */
export const REFRESH_INTERVAL_OPTIONS = [0, 1, 5, 15, 30] as const;

/** RG-018-01 : the only accepted values for the theme preference. */
export const THEME_OPTIONS = ['system', 'light', 'dark'] as const;

/** RG-022-01 : the only accepted values for the UI language preference. */
export const LANGUAGE_OPTIONS = ['fr', 'en'] as const;

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

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
 * Body of `PUT /api/v1/settings` — global preferences only (RG-019-23); the
 * per-connection identity is carried by `identities` instead of a single
 * `meUsername` (RG-019-08).
 *
 * `meEmail` follows a semantic different from most other fields (RG-002-02):
 * omitted from the body → left unchanged; empty string → cleared (stored
 * `null`); non-empty → stored trimmed. Trimming happens before validation so
 * a value like `"  marie@exemple.fr  "` still passes `@IsEmail` and a value
 * that is only whitespace is treated as empty.
 */
export class UpdateSettingsDto {
  /** My username per connection (RG-019-08) ; a connection absent from this array is left unchanged. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IdentityDto)
  identities?: IdentityDto[];

  @Transform(trim)
  @IsOptional()
  @ValidateIf(
    (o: UpdateSettingsDto) => o.meEmail !== undefined && o.meEmail !== '',
  )
  @IsEmail()
  meEmail?: string;

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
}
