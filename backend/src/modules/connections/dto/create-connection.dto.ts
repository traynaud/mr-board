import {
  IsIn,
  IsNotEmpty,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CONNECTION_TYPES } from '../../forges/types/connection-type';
import type { ConnectionType } from '../../forges/types/connection-type';

/** Shape validation shared by every connection URL — RG-001-01. */
export const FORGE_URL_OPTIONS = {
  require_protocol: true,
  require_tld: false,
  protocols: ['http', 'https'],
};

/** Minimum accepted length for a submitted token (RG-019-03). */
export const TOKEN_MIN_LENGTH = 8;

/** Maximum length of a connection name (RG-019-01). */
export const CONNECTION_NAME_MAX_LENGTH = 40;

/** Body of `POST /api/v1/connections`. */
export class CreateConnectionDto {
  /** Only `gitlab` is accepted in this US; `github` is rejected (RG-019-01). */
  @IsIn(CONNECTION_TYPES)
  type!: ConnectionType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(CONNECTION_NAME_MAX_LENGTH)
  name!: string;

  @IsUrl(FORGE_URL_OPTIONS)
  url!: string;

  /** Mandatory at creation (RG-019-03). */
  @IsString()
  @MinLength(TOKEN_MIN_LENGTH)
  token!: string;
}
