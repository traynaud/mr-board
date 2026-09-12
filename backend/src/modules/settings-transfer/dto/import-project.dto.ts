import { IsNotEmpty, IsString } from 'class-validator';

/** One repo entry of an imported config file (RG-015-04). */
export class ImportProjectDto {
  @IsString()
  @IsNotEmpty()
  pathWithNamespace!: string;

  @IsString()
  @IsNotEmpty()
  alias!: string;
}
