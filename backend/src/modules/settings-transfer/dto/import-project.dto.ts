import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PROJECT_COLOR_IDS } from '../../projects/domain/project-color';

/** One repo entry of a `version: 2` imported config file (RG-015-04, RG-019-18/19). */
export class ImportProjectDto {
  /** Name of the connection this repo belongs to (RG-019-19). */
  @IsString()
  @IsNotEmpty()
  connection!: string;

  @IsString()
  @IsNotEmpty()
  pathWithNamespace!: string;

  @IsString()
  @IsNotEmpty()
  alias!: string;

  /**
   * Absent (file exported before US-025) leaves a matched repo's color
   * untouched ; present (including `null`) always overwrites it (RG-025-08).
   * `@IsOptional` alone covers both `undefined` and `null` (it skips `@IsIn`
   * for either), no `@ValidateIf` needed.
   */
  @IsOptional()
  @IsIn(PROJECT_COLOR_IDS)
  color?: string | null;
}
