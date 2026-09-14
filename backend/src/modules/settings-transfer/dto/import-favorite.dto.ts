import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

/**
 * One favorite entry of a `version: 2` imported config file (RG-027-15).
 * No legacy `version: 1` equivalent — favorites did not exist before US-027.
 */
export class ImportFavoriteDto {
  /** Name of the connection the favorited merge request's repo belongs to. */
  @IsString()
  @IsNotEmpty()
  connection!: string;

  @IsString()
  @IsNotEmpty()
  pathWithNamespace!: string;

  @IsInt()
  @Min(1)
  iid!: number;
}
