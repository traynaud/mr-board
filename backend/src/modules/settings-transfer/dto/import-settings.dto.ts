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
} from 'class-validator';
import {
  LANGUAGE_OPTIONS,
  REFRESH_INTERVAL_OPTIONS,
  THEME_OPTIONS,
} from '../../settings/dto/update-settings.dto.js';
import type {
  Language,
  ThemePreference,
} from '../../settings/entities/settings.entity.js';

/**
 * The `settings` section of a `version: 2` imported config file (RG-015-04,
 * RG-019-23) — global preferences only, never the GitLab token, never a
 * connection's URL/username (those follow `connections`/RG-019-19 instead).
 * Mirrors `UpdateSettingsDto` minus `identities`.
 */
export class ImportSettingsDto {
  @IsOptional()
  @ValidateIf(
    (o: ImportSettingsDto) => o.meEmail !== undefined && o.meEmail !== '',
  )
  @IsEmail()
  meEmail?: string;

  @IsOptional()
  @IsIn(REFRESH_INTERVAL_OPTIONS)
  refreshIntervalMin?: number;

  @IsOptional()
  @IsBoolean()
  pauseWhenHidden?: boolean;

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

  @IsOptional()
  @IsInt()
  @Min(0)
  readyGreenDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  readyOrangeDays?: number;

  @IsOptional()
  @IsBoolean()
  workdaysOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  openInNewTab?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ignoredLabels?: string[];

  @IsOptional()
  @IsBoolean()
  notifyAssigned?: boolean;

  @IsOptional()
  @IsBoolean()
  tabBadge?: boolean;

  @IsOptional()
  @IsIn(THEME_OPTIONS)
  theme?: ThemePreference;

  @IsOptional()
  @IsBoolean()
  highlightMe?: boolean;

  @IsOptional()
  @IsIn(LANGUAGE_OPTIONS)
  language?: Language;
}
