import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

/** Alias charset/length (RG-003-04): URL-safe, no comma (breaks the CSV query params of RG-011-01). */
export const ALIAS_PATTERN = /^[A-Za-z0-9._-]{1,20}$/;

/** Body of `POST /api/v1/projects`. */
export class CreateProjectDto {
  /** Path (`groupe/projet`) or full URL — normalised server-side (RG-003-01). */
  @IsString()
  @IsNotEmpty()
  path!: string;

  /** Optional; derived from the path when omitted (RG-003-05). */
  @IsOptional()
  @IsString()
  @Matches(ALIAS_PATTERN)
  alias?: string;

  /** Required when more than one connection exists, implicit otherwise (RG-019-15). */
  @IsOptional()
  @IsInt()
  connectionId?: number;
}
