import { SettingsResponseDto } from '../../settings/dto/settings-response.dto.js';

/** One repo of an import that could not be applied (RG-015-04). */
export class ImportSkippedProjectDto {
  pathWithNamespace!: string;
  /** Business exception code (e.g. `projects.notFound`, `projects.aliasDuplicate`). */
  reason!: string;
}

/** Response of `POST /api/v1/settings/import`. */
export class ImportResultDto {
  settings!: SettingsResponseDto;
  connectionsAdded!: number;
  connectionsUpdated!: number;
  /** Names of newly created connections — always without a token (RG-019-19), to prompt the user to configure them. */
  newConnectionNames!: string[];
  projectsAdded!: number;
  projectsUpdated!: number;
  projectsSkipped!: ImportSkippedProjectDto[];
}
