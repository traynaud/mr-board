import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import type { ThemePreference } from '../entities/settings.entity';
import { GitlabCredentialsDto } from './gitlab-credentials.dto';

/** Maximum length accepted for a GitLab username (RG-002-02). */
export const ME_USERNAME_MAX_LENGTH = 255;

/** RG-013-01 : `0` = manual, no other value is accepted. */
export const REFRESH_INTERVAL_OPTIONS = [0, 1, 5, 15, 30] as const;

/** RG-018-01 : the only accepted values for the theme preference. */
export const THEME_OPTIONS = ['system', 'light', 'dark'] as const;

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Body of `PUT /api/v1/settings`.
 *
 * `meUsername`/`meEmail` follow a semantic different from `gitlabToken`
 * (RG-002-02): omitted from the body → left unchanged; empty string →
 * cleared (stored `null`); non-empty → stored trimmed. Trimming happens
 * before validation so a value like `"  marie@exemple.fr  "` still passes
 * `@IsEmail` and a value that is only whitespace is treated as empty.
 */
export class UpdateSettingsDto extends GitlabCredentialsDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(ME_USERNAME_MAX_LENGTH)
  meUsername?: string;

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
  @IsOptional()
  @IsBoolean()
  workdaysOnly?: boolean;

  /** Open MR titles in a new tab (RG-G11, RG-015-01). */
  @IsOptional()
  @IsBoolean()
  openInNewTab?: boolean;

  /** Labels that hide a merge request, compared case-insensitively (RG-015-02). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ignoredLabels?: string[];

  /** Browser notification when a merge request is newly assigned to me (RG-016-01/02). */
  @IsOptional()
  @IsBoolean()
  notifyAssigned?: boolean;

  /** Tab title badge counting red Ready-level merge requests (RG-016-04). */
  @IsOptional()
  @IsBoolean()
  tabBadge?: boolean;

  /** Theme preference (RG-018-01) : `system` follows the OS, `light`/`dark` force it. */
  @IsOptional()
  @IsIn(THEME_OPTIONS)
  theme?: ThemePreference;
}
