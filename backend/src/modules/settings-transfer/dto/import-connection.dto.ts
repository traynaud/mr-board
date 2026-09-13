import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import {
  CONNECTION_NAME_MAX_LENGTH,
  FORGE_URL_OPTIONS,
} from '../../connections/dto/create-connection.dto';
import { CONNECTION_TYPES } from '../../forges/types/connection-type';
import type { ConnectionType } from '../../forges/types/connection-type';

/**
 * One connection entry of a `version: 2` imported config file (RG-019-18/19).
 * Never carries a token — a connection created from an import always starts
 * without one (RG-019-19).
 */
export class ImportConnectionDto {
  @IsIn(CONNECTION_TYPES)
  type!: ConnectionType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(CONNECTION_NAME_MAX_LENGTH)
  name!: string;

  @IsUrl(FORGE_URL_OPTIONS)
  url!: string;

  @IsOptional()
  @IsString()
  meUsername?: string;
}
