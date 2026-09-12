import { Injectable } from '@nestjs/common';
import { ProjectsService } from '../projects/projects.service';
import { SettingsService } from '../settings/settings.service';
import { ExportConfigDto } from './dto/export-config.dto';
import { ImportConfigDto } from './dto/import-config.dto';
import { ImportResultDto } from './dto/import-result.dto';

/**
 * Orchestrates export/import of the whole configuration (RG-015-03,
 * RG-015-04) across `SettingsService` and `ProjectsService`. Lives outside
 * both modules to avoid a circular dependency: `ProjectsModule` already
 * imports `SettingsModule`, so `SettingsModule` cannot import
 * `ProjectsModule` back — this module imports both instead, the same way
 * `MergeRequestsModule` already does.
 */
@Injectable()
export class SettingsTransferService {
  constructor(
    private readonly settings: SettingsService,
    private readonly projects: ProjectsService,
  ) {}

  /** Every setting except the GitLab token, plus the configured repos (RG-015-03). */
  async export(): Promise<ExportConfigDto> {
    const [settings, projects] = await Promise.all([
      this.settings.getExportableSettings(),
      this.projects.list(),
    ]);
    return {
      version: 1,
      settings,
      projects: projects.map((project) => ({
        pathWithNamespace: project.pathWithNamespace,
        alias: project.alias,
      })),
    };
  }

  /**
   * Replaces every setting (never the token) and merges the repo list
   * additively (RG-015-04). Settings are applied first, then repos — a
   * partial repo failure never rolls back the settings replacement, which
   * matches the "always applied, best-effort repos" reading of RG-015-04.
   */
  async import(dto: ImportConfigDto): Promise<ImportResultDto> {
    const settings = await this.settings.applyImportedSettings(dto.settings);
    const { added, updated, skipped } = await this.projects.importMany(
      dto.projects,
    );
    return {
      settings,
      projectsAdded: added,
      projectsUpdated: updated,
      projectsSkipped: skipped,
    };
  }
}
