import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  CONNECTION_NAME_MAX_LENGTH,
  CONNECTION_NAME_PATTERN,
  FORGE_URL_OPTIONS,
  TOKEN_MIN_LENGTH,
} from './create-connection.dto.js';

/**
 * Body of `PUT /api/v1/connections/:id`. `type` is never accepted — not
 * modifiable after creation (RG-019-11). `token` absent = unchanged
 * (RG-019-03).
 */
export class UpdateConnectionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(CONNECTION_NAME_MAX_LENGTH)
  @Matches(CONNECTION_NAME_PATTERN)
  name?: string;

  @IsOptional()
  @IsUrl(FORGE_URL_OPTIONS)
  url?: string;

  @IsOptional()
  @IsString()
  @MinLength(TOKEN_MIN_LENGTH)
  token?: string;
}
