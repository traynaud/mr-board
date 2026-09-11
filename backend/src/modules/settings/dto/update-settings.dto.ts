import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

/** Minimum accepted token length (RG-001-02). */
export const TOKEN_MIN_LENGTH = 8;

/** Validation options shared by every GitLab URL field. */
export const GITLAB_URL_OPTIONS = {
  require_protocol: true,
  require_tld: false,
  protocols: ['http', 'https'],
};

/** Body of `PUT /api/v1/settings`. */
export class UpdateSettingsDto {
  @IsUrl(GITLAB_URL_OPTIONS)
  gitlabUrl!: string;

  /** Omitted or empty: the stored token is kept unchanged. */
  @Transform(({ value }) => (value === '' ? undefined : (value as unknown)))
  @IsOptional()
  @IsString()
  @MinLength(TOKEN_MIN_LENGTH)
  gitlabToken?: string;
}
