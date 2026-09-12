import { SettingsResponseDto } from '../../settings/dto/settings-response.dto';

/** One repo of an import that could not be applied (RG-015-04). */
export class ImportSkippedProjectDto {
  pathWithNamespace!: string;
  /** Business exception code (e.g. `projects.notFound`, `projects.aliasDuplicate`). */
  reason!: string;
}

/** Response of `POST /api/v1/settings/import`. */
export class ImportResultDto {
  settings!: SettingsResponseDto;
  projectsAdded!: number;
  projectsUpdated!: number;
  projectsSkipped!: ImportSkippedProjectDto[];
}
