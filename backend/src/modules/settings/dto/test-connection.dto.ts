import { UpdateSettingsDto } from './update-settings.dto';

/**
 * Body of `POST /api/v1/settings/test-connection`.
 * Same shape and validation as {@link UpdateSettingsDto}; when `gitlabToken`
 * is omitted or empty, the stored token is tested instead (RG-001-04).
 */
export class TestConnectionDto extends UpdateSettingsDto {}
