import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  CONNECTION_NAME_MAX_LENGTH,
  FORGE_URL_OPTIONS,
  TOKEN_MIN_LENGTH,
} from './create-connection.dto';

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
  name?: string;

  @IsOptional()
  @IsUrl(FORGE_URL_OPTIONS)
  url?: string;

  @IsOptional()
  @IsString()
  @MinLength(TOKEN_MIN_LENGTH)
  token?: string;
}
