import { Injectable } from '@nestjs/common';
import { ConnectionsService } from '../connections/connections.service.js';
import { FavoritesService } from '../favorites/favorites.service.js';
import {
  ImportProjectEntry,
  ProjectsService,
} from '../projects/projects.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { ExportConfigDto } from './dto/export-config.dto.js';
import { ImportConfigDto } from './dto/import-config.dto.js';
import { ImportFavoriteDto } from './dto/import-favorite.dto.js';
import { ImportSettingsLegacyDto } from './dto/import-settings-legacy.dto.js';
import { ImportProjectDto } from './dto/import-project.dto.js';
import { ImportProjectLegacyDto } from './dto/import-project-legacy.dto.js';
import { ImportResultDto } from './dto/import-result.dto.js';

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
    private readonly favorites: FavoritesService,
  ) {}

  /** Every global preference, connection, repo and favorite, `version: 2` (RG-019-18, RG-027-15). */
  async export(): Promise<ExportConfigDto> {
    const [settings, connections, projects, favorites] = await Promise.all([
      this.settings.getExportableSettings(),
      this.connections.findAll(),
      this.projects.list(),
      this.favorites.list(),
    ]);
    const connectionsById = new Map(connections.map((c) => [c.id, c]));
    const projectsById = new Map(projects.map((p) => [p.id, p]));
    return {
      version: 2,
      settings,
      connections: connections.map((connection) => ({
        type: connection.type,
        name: connection.name,
        url: connection.url,
      })),
      projects: projects.map((project) => ({
        connection: connectionsById.get(project.connectionId)!.name,
        pathWithNamespace: project.pathWithNamespace,
        alias: project.alias,
        color: project.color,
      })),
      // RG-027-15 : un favori dont le projet a disparu (cas impossible en
      // pratique, cascade RG-027-05) est silencieusement omis plutôt que de
      // faire échouer l'export.
      favorites: favorites.flatMap((favorite) => {
        const project = projectsById.get(favorite.projectId);
        if (!project) {
          return [];
        }
        return [
          {
            connection: connectionsById.get(project.connectionId)!.name,
            pathWithNamespace: project.pathWithNamespace,
            iid: favorite.iid,
          },
        ];
      }),
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
        }),
      );
    }
    const entries: ImportProjectEntry[] = (
      dto.projects as ImportProjectDto[]
    ).map((entry) => ({
      pathWithNamespace: entry.pathWithNamespace,
      alias: entry.alias,
      connectionName: entry.connection,
      color: entry.color,
    }));
    const result = await this.applyProjects(settings, connections, entries);
    await this.importFavorites(dto.favorites ?? []);
    return result;
  }

  /**
   * RG-027-15 : resolves each favorite entry to a repo by (connection name,
   * chemin) among the repos just imported/already configured — a favorite
   * whose repo can't be resolved is **ignored silently**. Additive : never
   * removes an existing favorite (`FavoritesService.add` is idempotent).
   */
  private async importFavorites(entries: ImportFavoriteDto[]): Promise<void> {
    if (entries.length === 0) {
      return;
    }
    const [projects, connections] = await Promise.all([
      this.projects.list(),
      this.connections.findAll(),
    ]);
    const connectionIdByName = new Map(
      connections.map((connection) => [connection.name, connection.id]),
    );
    const projectByKey = new Map(
      projects.map((project) => [
        `${project.connectionId}:${project.pathWithNamespace}`,
        project,
      ]),
    );
    for (const entry of entries) {
      const connectionId = connectionIdByName.get(entry.connection);
      if (connectionId === undefined) {
        continue;
      }
      const project = projectByKey.get(
        `${connectionId}:${entry.pathWithNamespace}`,
      );
      if (!project) {
        continue;
      }
      await this.favorites.add(project.id, entry.iid);
    }
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
