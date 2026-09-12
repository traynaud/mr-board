import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  BusinessException,
  BusinessValidationException,
  EntityNotFoundException,
  GitlabAuthException,
  MissingConfigurationException,
} from '../../common/exceptions';
import { GitlabClientService } from '../gitlab/gitlab-client.service';
import { SettingsService } from '../settings/settings.service';
import { deriveDefaultAlias } from './domain/derive-default-alias';
import { normalizeProjectPath } from './domain/normalize-project-path';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectResponseDto } from './dto/project-response.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Project } from './entities/project.entity';

/** Outcome of `importMany` (RG-015-04). */
export interface ImportProjectsResult {
  added: number;
  updated: number;
  skipped: { pathWithNamespace: string; reason: string }[];
}

/** Manages the list of GitLab repositories configured to be scanned. */
@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly repository: Repository<Project>,
    private readonly settings: SettingsService,
    private readonly gitlab: GitlabClientService,
  ) {}

  /** Configured repositories, in the order they were added (RG-003-09). */
  async list(): Promise<ProjectResponseDto[]> {
    const projects = await this.repository.find({ order: { id: 'ASC' } });
    return projects.map(toResponse);
  }

  /**
   * Active repositories, in the order they were added — used by
   * `SyncService` to resolve the targets of an unscoped synchronisation.
   */
  async listActive(): Promise<Project[]> {
    return this.repository.find({
      where: { enabled: true },
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
   * Resolves and adds a repository (RG-003-01 to RG-003-06).
   * @throws MissingConfigurationException when no GitLab token is configured (409).
   * @throws BusinessValidationException for an unresolvable path, a duplicate
   * alias, or a normalisation failure (400).
   * @throws BusinessException (409) when the GitLab project is already configured.
   */
  async add(dto: CreateProjectDto): Promise<ProjectResponseDto> {
    const path = normalizeProjectPath(dto.path);
    if (!path) {
      throw new BusinessValidationException(
        'projects.notFound',
        'Path could not be resolved',
      );
    }
    const url = await this.settings.getGitlabUrl();
    const token = await this.settings.getToken();
    if (!token) {
      throw new MissingConfigurationException(
        'settings.tokenMissing',
        'No GitLab token configured',
      );
    }

    let gitlabProject: Awaited<ReturnType<GitlabClientService['getProject']>>;
    try {
      gitlabProject = await this.gitlab.getProject(url, token, path);
    } catch (error) {
      if (error instanceof GitlabAuthException) {
        throw new BusinessValidationException(
          'projects.notFound',
          'GitLab denied access to this project',
        );
      }
      throw error;
    }
    if (!gitlabProject) {
      throw new BusinessValidationException(
        'projects.notFound',
        'Project not found on GitLab',
      );
    }

    await this.assertProjectNotConfigured(gitlabProject.id);
    const alias =
      dto.alias ?? deriveDefaultAlias(gitlabProject.path_with_namespace);
    await this.assertAliasAvailable(alias);

    const project = await this.repository.save(
      this.repository.create({
        gitlabProjectId: gitlabProject.id,
        pathWithNamespace: gitlabProject.path_with_namespace,
        webUrl: gitlabProject.web_url,
        alias,
        enabled: true,
        createdAt: new Date().toISOString(),
      }),
    );
    return toResponse(project);
  }

  /**
   * Renames a repository's alias (RG-003-07).
   * @throws EntityNotFoundException when `id` is unknown (404).
   * @throws BusinessValidationException when the alias is already used by another repo (400).
   */
  async rename(id: number, dto: UpdateProjectDto): Promise<ProjectResponseDto> {
    const project = await this.findOrThrow(id);
    await this.assertAliasAvailable(dto.alias, id);
    project.alias = dto.alias;
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
   * Merges an imported repo list additively (RG-015-04): a repo already
   * configured (matched by `pathWithNamespace`, case-insensitive) only has
   * its alias updated ; an unmatched one is resolved against GitLab exactly
   * like `add()`. Never removes a repo. A failure on one entry (GitLab
   * 404, alias clash…) is collected in `skipped` instead of aborting the
   * whole import.
   */
  async importMany(
    entries: { pathWithNamespace: string; alias: string }[],
  ): Promise<ImportProjectsResult> {
    const existing = await this.repository.find();
    const byPath = new Map(
      existing.map((project) => [
        project.pathWithNamespace.toLowerCase(),
        project,
      ]),
    );
    let added = 0;
    let updated = 0;
    const skipped: { pathWithNamespace: string; reason: string }[] = [];

    for (const entry of entries) {
      const match = byPath.get(entry.pathWithNamespace.toLowerCase());
      try {
        if (match) {
          await this.rename(match.id, { alias: entry.alias });
          updated += 1;
        } else {
          await this.add({
            path: entry.pathWithNamespace,
            alias: entry.alias,
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

  private async findOrThrow(id: number): Promise<Project> {
    const project = await this.repository.findOneBy({ id });
    if (!project) {
      throw new EntityNotFoundException('Project', id);
    }
    return project;
  }

  private async assertProjectNotConfigured(
    gitlabProjectId: number,
  ): Promise<void> {
    const existing = await this.repository.findOneBy({ gitlabProjectId });
    if (existing) {
      throw new BusinessException(
        'projects.alreadyConfigured',
        `Project ${gitlabProjectId} is already configured`,
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
    pathWithNamespace: project.pathWithNamespace,
    alias: project.alias,
    gitlabProjectId: project.gitlabProjectId,
  };
}
