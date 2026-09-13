import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';
import { CONNECTION_TYPES } from '../../forges/types/connection-type';
import type { ConnectionType } from '../../forges/types/connection-type';
import { FORGE_URL_OPTIONS, TOKEN_MIN_LENGTH } from './create-connection.dto';

/**
 * Body of `POST /api/v1/connections/test` (RG-001-04, RG-019-14).
 * - From the "add" form (no `connectionId`): `type`/`url`/`token` are
 *   required — there is no stored connection to fall back to.
 * - From the list or the "edit" form (`connectionId` present): `type`/`url`
 *   default to the stored connection's, `token` absent = the stored token.
 */
export class TestConnectionDto {
  @IsOptional()
  @IsIn(CONNECTION_TYPES)
  type?: ConnectionType;

  @IsOptional()
  @IsUrl(FORGE_URL_OPTIONS)
  url?: string;

  @IsOptional()
  @IsString()
  @MinLength(TOKEN_MIN_LENGTH)
  token?: string;

  @IsOptional()
  @IsInt()
  connectionId?: number;
}
