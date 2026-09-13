import { ConnectionType } from '../../forges/types/connection-type';
import type { ExportableSettings } from '../../settings/settings.service';

/** One connection entry of `GET /api/v1/settings/export` (RG-019-18). Never carries the token. */
export class ExportConnectionDto {
  type!: ConnectionType;
  name!: string;
  url!: string;
  meUsername!: string | null;
}

/** One repo entry of `GET /api/v1/settings/export` (RG-019-18). */
export class ExportProjectDto {
  /** Name of the connection this repo belongs to. */
  connection!: string;
  pathWithNamespace!: string;
  alias!: string;
}

/** Response of `GET /api/v1/settings/export`. Never carries a token. */
export class ExportConfigDto {
  version!: 2;
  settings!: ExportableSettings;
  connections!: ExportConnectionDto[];
  projects!: ExportProjectDto[];
}
