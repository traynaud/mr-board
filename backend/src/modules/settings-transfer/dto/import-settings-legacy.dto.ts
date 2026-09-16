import { IsOptional, IsString, IsUrl } from 'class-validator';
import { FORGE_URL_OPTIONS } from '../../connections/dto/create-connection.dto.js';
import { ImportSettingsDto } from './import-settings.dto.js';

/**
 * The `settings` section of a `version: 1` imported config file, from
 * before US-019 : still carries the single-instance `gitlabUrl` that
 * RG-019-06 converts into a connection (RG-019-19).
 */
export class ImportSettingsLegacyDto extends ImportSettingsDto {
  @IsUrl(FORGE_URL_OPTIONS)
  gitlabUrl!: string;

  /**
   * Accepted-but-ignored (RG-031-14) : kept declared only so the global
   * `ValidationPipe` (`forbidNonWhitelisted: true`) doesn't 400 on a
   * pre-US-031 export — the identity is now resolved from the token instead.
   */
  @IsOptional()
  @IsString()
  meUsername?: string;
}
