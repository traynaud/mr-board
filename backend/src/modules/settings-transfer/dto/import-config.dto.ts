import { Type } from 'class-transformer';
import { IsArray, IsIn, IsOptional, ValidateNested } from 'class-validator';
import { ImportConnectionDto } from './import-connection.dto.js';
import { ImportFavoriteDto } from './import-favorite.dto.js';
import { ImportProjectDto } from './import-project.dto.js';
import { ImportProjectLegacyDto } from './import-project-legacy.dto.js';
import { ImportSettingsDto } from './import-settings.dto.js';
import { ImportSettingsLegacyDto } from './import-settings-legacy.dto.js';

/** Body of `POST /api/v1/settings/import` (RG-015-04, RG-019-18/19). */
export class ImportConfigDto {
  /** `1` (pre-US-019) or `2` — any other value is rejected (400). */
  @IsIn([1, 2])
  version!: 1 | 2;

  @ValidateNested()
  @Type((options) =>
    (options?.object as ImportConfigDto)?.version === 1
      ? ImportSettingsLegacyDto
      : ImportSettingsDto,
  )
  settings!: ImportSettingsDto | ImportSettingsLegacyDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type((options) =>
    (options?.object as ImportConfigDto)?.version === 1
      ? ImportProjectLegacyDto
      : ImportProjectDto,
  )
  projects!: (ImportProjectDto | ImportProjectLegacyDto)[];

  /** `version: 2` only ; absent/ignored on a `version: 1` file (RG-019-19). */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportConnectionDto)
  connections?: ImportConnectionDto[];

  /** `version: 2` only ; absent/ignored on a `version: 1` file (RG-027-15). */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportFavoriteDto)
  favorites?: ImportFavoriteDto[];
}
