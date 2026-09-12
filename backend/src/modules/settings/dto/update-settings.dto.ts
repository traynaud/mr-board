import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { GitlabCredentialsDto } from './gitlab-credentials.dto';

/** Maximum length accepted for a GitLab username (RG-002-02). */
export const ME_USERNAME_MAX_LENGTH = 255;

/** RG-013-01 : `0` = manual, no other value is accepted. */
export const REFRESH_INTERVAL_OPTIONS = [0, 1, 5, 15, 30] as const;

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
}
