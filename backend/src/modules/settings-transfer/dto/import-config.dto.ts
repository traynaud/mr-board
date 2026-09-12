import { Type } from 'class-transformer';
import { IsArray, IsIn, ValidateNested } from 'class-validator';
import { ImportProjectDto } from './import-project.dto';
import { ImportSettingsDto } from './import-settings.dto';

/** Body of `POST /api/v1/settings/import` (RG-015-04). */
export class ImportConfigDto {
  /** Only `1` is understood ; any other value is rejected (400). */
  @IsIn([1])
  version!: number;

  @ValidateNested()
  @Type(() => ImportSettingsDto)
  settings!: ImportSettingsDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportProjectDto)
  projects!: ImportProjectDto[];
}
