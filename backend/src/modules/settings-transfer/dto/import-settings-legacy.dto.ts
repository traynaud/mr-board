import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { FORGE_URL_OPTIONS } from '../../connections/dto/create-connection.dto.js';
import { ImportSettingsDto } from './import-settings.dto.js';

/** Maximum length accepted for a legacy GitLab username (RG-002-02). */
export const ME_USERNAME_MAX_LENGTH = 255;

/**
 * The `settings` section of a `version: 1` imported config file, from
 * before US-019 : still carries the single-instance `gitlabUrl`/`meUsername`
 * that RG-019-06 converts into a connection (RG-019-19).
 */
export class ImportSettingsLegacyDto extends ImportSettingsDto {
  @IsUrl(FORGE_URL_OPTIONS)
  gitlabUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(ME_USERNAME_MAX_LENGTH)
  meUsername?: string;
}
