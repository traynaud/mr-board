import { IsNotEmpty, IsString } from 'class-validator';

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
}
