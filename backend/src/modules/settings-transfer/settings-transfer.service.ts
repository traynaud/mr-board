import { Injectable } from '@nestjs/common';
import { ConnectionsService } from '../connections/connections.service';
import {
  ImportProjectEntry,
  ProjectsService,
} from '../projects/projects.service';
import { SettingsService } from '../settings/settings.service';
import { ExportConfigDto } from './dto/export-config.dto';
import { ImportConfigDto } from './dto/import-config.dto';
import { ImportSettingsLegacyDto } from './dto/import-settings-legacy.dto';
import { ImportProjectDto } from './dto/import-project.dto';
import { ImportProjectLegacyDto } from './dto/import-project-legacy.dto';
import { ImportResultDto } from './dto/import-result.dto';

/** Name given to the connection created from a `version: 1` file (RG-019-06/19). */
const LEGACY_CONNECTION_NAME = 'GitLab';

/**
 * Orchestrates export/import of the whole configuration (RG-015-03,
 * RG-015-04, RG-019-18/19) across `SettingsService`, `ConnectionsService` and
 * `ProjectsService`. Lives outside all three to avoid circular dependencies,
 * the same way `MergeRequestsModule` already does.
 */
@Injectable()
export class SettingsTransferService {
  constructor(
    private readonly settings: SettingsService,
    private readonly connections: ConnectionsService,
    private readonly projects: ProjectsService,
  ) {}

  /** Every global preference, connection and repo, `version: 2` (RG-019-18). */
  async export(): Promise<ExportConfigDto> {
    const [settings, connections, projects] = await Promise.all([
      this.settings.getExportableSettings(),
      this.connections.findAll(),
      this.projects.list(),
    ]);
    const connectionsById = new Map(connections.map((c) => [c.id, c]));
    return {
      version: 2,
      settings,
      connections: connections.map((connection) => ({
        type: connection.type,
        name: connection.name,
        url: connection.url,
        meUsername: connection.meUsername,
      })),
      projects: projects.map((project) => ({
        connection: connectionsById.get(project.connectionId)!.name,
        pathWithNamespace: project.pathWithNamespace,
        alias: project.alias,
      })),
    };
  }

  /**
   * Imports a `version: 1` (pre-US-019) or `version: 2` file (RG-019-19).
   * Settings are applied first, then connections, then repos — a partial
   * repo or connection failure never rolls back the settings replacement.
   */
  async import(dto: ImportConfigDto): Promise<ImportResultDto> {
    return dto.version === 1
      ? this.importLegacy(dto.settings as ImportSettingsLegacyDto, dto.projects)
      : this.importCurrent(dto);
  }

  /**
   * RG-019-06/19 : the legacy GitLab URL/token-less username become a single
   * connection named "GitLab" (merged by name if it already exists), every
   * repo rattached to it.
   */
  private async importLegacy(
    settingsDto: ImportSettingsLegacyDto,
    projectEntries: ImportProjectLegacyDto[],
  ): Promise<ImportResultDto> {
    const settings = await this.settings.applyImportedSettings(settingsDto);
    const connection = await this.connections.importUpsert({
      type: 'gitlab',
      name: LEGACY_CONNECTION_NAME,
      url: settingsDto.gitlabUrl,
      meUsername: settingsDto.meUsername?.trim() || null,
    });
    const entries: ImportProjectEntry[] = projectEntries.map((entry) => ({
      pathWithNamespace: entry.pathWithNamespace,
      alias: entry.alias,
      connectionName: connection.name,
    }));
    return this.applyProjects(settings, [connection], entries);
  }

  /** RG-019-18/19 : connections merged by name, repos rattached by connection name. */
  private async importCurrent(dto: ImportConfigDto): Promise<ImportResultDto> {
    const settings = await this.settings.applyImportedSettings(dto.settings);
    const connections: { name: string; created: boolean }[] = [];
    for (const connection of dto.connections ?? []) {
      connections.push(
        await this.connections.importUpsert({
          type: connection.type,
          name: connection.name,
          url: connection.url,
          meUsername: connection.meUsername?.trim() || null,
        }),
      );
    }
    const entries: ImportProjectEntry[] = (
      dto.projects as ImportProjectDto[]
    ).map((entry) => ({
      pathWithNamespace: entry.pathWithNamespace,
      alias: entry.alias,
      connectionName: entry.connection,
    }));
    return this.applyProjects(settings, connections, entries);
  }

  private async applyProjects(
    settings: ImportResultDto['settings'],
    connections: { name: string; created: boolean }[],
    entries: ImportProjectEntry[],
  ): Promise<ImportResultDto> {
    const { added, updated, skipped } = await this.projects.importMany(entries);
    return {
      settings,
      connectionsAdded: connections.filter((c) => c.created).length,
      connectionsUpdated: connections.filter((c) => !c.created).length,
      newConnectionNames: connections
        .filter((c) => c.created)
        .map((c) => c.name),
      projectsAdded: added,
      projectsUpdated: updated,
      projectsSkipped: skipped,
    };
  }
}
