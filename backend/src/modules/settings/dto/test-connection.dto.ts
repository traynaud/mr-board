import { GitlabCredentialsDto } from './gitlab-credentials.dto';

/**
 * Body of `POST /api/v1/settings/test-connection`.
 * Same shape and validation as {@link GitlabCredentialsDto}; when
 * `gitlabToken` is omitted or empty, the stored token is tested instead
 * (RG-001-04). Deliberately excludes the identity fields of
 * `UpdateSettingsDto`: this endpoint never reads or needs them.
 */
export class TestConnectionDto extends GitlabCredentialsDto {}
