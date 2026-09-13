import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { GITLAB_URL_OPTIONS } from '../../settings/dto/gitlab-credentials.dto';
import {
  LANGUAGE_OPTIONS,
  ME_USERNAME_MAX_LENGTH,
  REFRESH_INTERVAL_OPTIONS,
  THEME_OPTIONS,
} from '../../settings/dto/update-settings.dto';
import type {
  Language,
  ThemePreference,
} from '../../settings/entities/settings.entity';

/**
 * The `settings` section of an imported config file (RG-015-04). Mirrors
 * `UpdateSettingsDto` field-for-field, minus `gitlabToken` — deliberately
 * absent, never `IsOptional`, so a file carrying one is rejected by the
 * global `ValidationPipe` (`forbidNonWhitelisted`) instead of being silently
 * accepted (RG-015-04 : "le jeton n'est jamais importé").
 */
export class ImportSettingsDto {
  @IsUrl(GITLAB_URL_OPTIONS)
  gitlabUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(ME_USERNAME_MAX_LENGTH)
  meUsername?: string;

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
