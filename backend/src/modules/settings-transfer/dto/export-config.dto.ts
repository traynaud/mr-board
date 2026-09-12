import type { ExportableSettings } from '../../settings/settings.service';

/** One repo entry of `GET /api/v1/settings/export` (RG-015-03). */
export class ExportProjectDto {
  pathWithNamespace!: string;
  alias!: string;
}

/** Response of `GET /api/v1/settings/export`. Never carries the GitLab token. */
export class ExportConfigDto {
  version!: 1;
  settings!: ExportableSettings;
  projects!: ExportProjectDto[];
}
