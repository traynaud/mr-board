import { IsNotEmpty, IsString } from 'class-validator';

/**
 * One repo entry of a `version: 1` imported config file, from before
 * US-019 — no `connection` field, all rattached to the single migrated
 * connection (RG-019-19).
 */
export class ImportProjectLegacyDto {
  @IsString()
  @IsNotEmpty()
  pathWithNamespace!: string;

  @IsString()
  @IsNotEmpty()
  alias!: string;
}
