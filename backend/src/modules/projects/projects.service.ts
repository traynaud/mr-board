import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  BusinessException,
  BusinessValidationException,
  ConnectionMissingException,
  ConnectionTokenMissingException,
  EntityNotFoundException,
  ForgeAuthException,
} from '../../common/exceptions/index.js';
import { ConnectionsService } from '../connections/connections.service.js';
import { ForgeClientFactory } from '../forges/forge-client.factory.js';
import { deriveDefaultAlias } from './domain/derive-default-alias.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { ProjectResponseDto } from './dto/project-response.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { Project } from './entities/project.entity.js';

/** Outcome of `importMany` (RG-015-04). */
export interface ImportProjectsResult {
  added: number;
  updated: number;
  skipped: { pathWithNamespace: string; reason: string }[];
}

/**
 * One repo entry to import, already resolved to a connection by name
 * (RG-019-19). `color` follows RG-025-08 : absent (`undefined`, files
 * exported before US-025) leaves a matched repo's color untouched ; present
 * (including `null`) always overwrites it, exactly like `alias`.
 */
export interface ImportProjectEntry {
  pathWithNamespace: string;
  alias: string;
  connectionName: string;
  color?: string | null;
}

/** Manages the list of repositories configured to be scanned. */
@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly repository: Repository<Project>,
    private readonly connections: ConnectionsService,
    private readonly forges: ForgeClientFactory,
  ) {}

  /** Configured repositories, in the order they were added (RG-003-09). */
  async list(): Promise<ProjectResponseDto[]> {
    const projects = await this.repository.find({ order: { id: 'ASC' } });
    return projects.map(toResponse);
  }

  /**
   * Active repositories of a connection, in the order they were added — used
   * by `SyncService` to resolve the targets of an unscoped synchronisation
   * (RG-019-16).
   */
  async listActiveByConnection(connectionId: number): Promise<Project[]> {
    return this.repository.find({
      where: { connectionId, enabled: true },
      order: { id: 'ASC' },
    });
  }

  /**
   * Raw entity for internal, server-side use only (unlike `list`/`rename`,
   * never a 404).
   * @returns `null` when `id` is unknown — used by `SyncService` to validate
   * a `projectId` before starting a targeted synchronisation.
   */
  async findById(id: number): Promise<Project | null> {
    return this.repository.findOneBy({ id });
  }

  /**
   * Raw entities for internal, server-side use only — used by
   * `MergeRequestsService.listOpen` to resolve `projectAlias` in bulk.
   * @returns entities in no particular order; missing ids are silently omitted.
   */
  async findByIds(ids: number[]): Promise<Project[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.repository.findBy({ id: In(ids) });
  }

  /**
   * Resolves and adds a repository (RG-003-01 to RG-003-06, RG-019-15).
   * @throws ConnectionMissingException when no connection is configured (409).
   * @throws BusinessValidationException when `connectionId` is required (≥ 2
   * connections) but absent, for an unresolvable path, a duplicate alias, or
   * a normalisation failure (400).
   * @throws ConnectionTokenMissingException when the connection has no token (409).
   * @throws BusinessException (409) when the repo is already configured on this connection.
   */
  async add(dto: CreateProjectDto): Promise<ProjectResponseDto> {
    const connectionId = await this.resolveConnectionId(dto.connectionId);
    const connection = await this.connections.findOrThrow(connectionId);
    const token = await this.connections.getToken(connectionId);
    if (!token) {
      throw new ConnectionTokenMissingException();
    }
    const forge = this.forges.forType(connection.type);

    // Resolved via the connection's own forge (RG-020-05) — GitHub enforces
    // a strict `owner/repo` shape (`projects.invalidPath`) where GitLab
    // accepts any depth of (sub)groups, so this cannot happen before the
    // forge is known.
    const path = forge.normalizePath(dto.path);
    if (!path) {
      throw new BusinessValidationException(
        'projects.notFound',
        'Path could not be resolved',
      );
    }

    let forgeProject: Awaited<ReturnType<typeof forge.resolveProject>>;
    try {
      forgeProject = await forge.resolveProject(connection.url, token, path);
    } catch (error) {
      if (error instanceof ForgeAuthException) {
        throw new BusinessValidationException(
          'projects.notFound',
          'The forge denied access to this project',
        );
      }
      throw error;
    }
    if (!forgeProject) {
      throw new BusinessValidationException(
        'projects.notFound',
        'Project not found on the forge',
      );
    }

    await this.assertProjectNotConfigured(
      connectionId,
      forgeProject.remoteProjectId,
    );
    const alias =
      dto.alias ?? deriveDefaultAlias(forgeProject.pathWithNamespace);
    await this.assertAliasAvailable(alias);

    const project = await this.repository.save(
      this.repository.create({
        connectionId,
        remoteProjectId: forgeProject.remoteProjectId,
        pathWithNamespace: forgeProject.pathWithNamespace,
        webUrl: forgeProject.webUrl,
        alias,
        enabled: true,
        color: dto.color ?? null,
        createdAt: new Date().toISOString(),
      }),
    );
    return toResponse(project);
  }

  /**
   * Renames a repository's alias and/or updates its tag color (RG-003-07,
   * RG-025-07).
   * @throws EntityNotFoundException when `id` is unknown (404).
   * @throws BusinessValidationException when the alias is already used by another repo (400).
   */
  async rename(id: number, dto: UpdateProjectDto): Promise<ProjectResponseDto> {
    const project = await this.findOrThrow(id);
    await this.assertAliasAvailable(dto.alias, id);
    project.alias = dto.alias;
    project.color = dto.color;
    return toResponse(await this.repository.save(project));
  }

  /**
   * Removes a repository (RG-003-08). Its merge requests (and their
   * reviewer/assignee rows) cascade at the database level (US-004).
   * @throws EntityNotFoundException when `id` is unknown (404).
   */
  async remove(id: number): Promise<void> {
    const project = await this.findOrThrow(id);
    await this.repository.remove(project);
  }

  /**
   * Merges an imported repo list additively (RG-015-04, RG-019-19): a repo
   * already configured on the target connection (matched by
   * `pathWithNamespace`, case-insensitive) has its alias updated, and its
   * color too when the entry carries one (RG-025-08 : `entry.color`
   * `undefined` — file exported before US-025 — leaves the existing color
   * untouched) ; an unmatched one is resolved against the forge exactly like
   * `add()`. Never removes a repo. A failure on one entry (connection
   * unknown, no token, forge 404, alias clash…) is collected in `skipped`
   * instead of aborting the whole import.
   */
  async importMany(
    entries: ImportProjectEntry[],
  ): Promise<ImportProjectsResult> {
    const existing = await this.repository.find();
    const connectionsByName = new Map(
      (await this.connections.findAll()).map((connection) => [
        connection.name.toLowerCase(),
        connection,
      ]),
    );
    let added = 0;
    let updated = 0;
    const skipped: { pathWithNamespace: string; reason: string }[] = [];

    for (const entry of entries) {
      const connection = connectionsByName.get(
        entry.connectionName.toLowerCase(),
      );
      if (!connection) {
        skipped.push({
          pathWithNamespace: entry.pathWithNamespace,
          reason: 'connections.unknown',
        });
        continue;
      }
      const match = existing.find(
        (project) =>
          project.connectionId === connection.id &&
          project.pathWithNamespace.toLowerCase() ===
            entry.pathWithNamespace.toLowerCase(),
      );
      try {
        if (match) {
          await this.rename(match.id, {
            alias: entry.alias,
            color: entry.color === undefined ? match.color : entry.color,
          });
          updated += 1;
        } else {
          await this.add({
            path: entry.pathWithNamespace,
            alias: entry.alias,
            connectionId: connection.id,
            color: entry.color ?? undefined,
          });
          added += 1;
        }
      } catch (error) {
        skipped.push({
          pathWithNamespace: entry.pathWithNamespace,
          reason: error instanceof BusinessException ? error.code : 'unknown',
        });
      }
    }

    return { added, updated, skipped };
  }

  /**
   * Resolves the target connection of a repo addition (RG-019-15): the sole
   * existing connection when there is only one, the explicit `connectionId`
   * otherwise.
   * @throws ConnectionMissingException when no connection exists at all (409).
   * @throws BusinessValidationException when `connectionId` is required (≥ 2 connections) but absent (400).
   */
  private async resolveConnectionId(connectionId?: number): Promise<number> {
    const all = await this.connections.findAll();
    if (all.length === 0) {
      throw new ConnectionMissingException();
    }
    if (connectionId !== undefined) {
      return connectionId;
    }
    if (all.length === 1) {
      return all[0].id;
    }
    throw new BusinessValidationException(
      'projects.connectionRequired',
      'connectionId is required when more than one connection exists',
    );
  }

  private async findOrThrow(id: number): Promise<Project> {
    const project = await this.repository.findOneBy({ id });
    if (!project) {
      throw new EntityNotFoundException('Project', id);
    }
    return project;
  }

  private async assertProjectNotConfigured(
    connectionId: number,
    remoteProjectId: string,
  ): Promise<void> {
    const existing = await this.repository.findOneBy({
      connectionId,
      remoteProjectId,
    });
    if (existing) {
      throw new BusinessException(
        'projects.alreadyConfigured',
        `Project ${remoteProjectId} is already configured on connection ${connectionId}`,
        HttpStatus.CONFLICT,
      );
    }
  }

  private async assertAliasAvailable(
    alias: string,
    excludeId?: number,
  ): Promise<void> {
    const clash = (await this.repository.find()).find(
      (p) =>
        p.id !== excludeId && p.alias.toLowerCase() === alias.toLowerCase(),
    );
    if (clash) {
      throw new BusinessValidationException(
        'projects.aliasDuplicate',
        `Alias "${alias}" is already used`,
      );
    }
  }
}

function toResponse(project: Project): ProjectResponseDto {
  return {
    id: project.id,
    connectionId: project.connectionId,
    pathWithNamespace: project.pathWithNamespace,
    alias: project.alias,
    remoteProjectId: project.remoteProjectId,
    color: project.color,
  };
}
