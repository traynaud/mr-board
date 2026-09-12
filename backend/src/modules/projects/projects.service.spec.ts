import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import {
  BusinessException,
  BusinessValidationException,
  EntityNotFoundException,
  GitlabAuthException,
  GitlabUnavailableException,
  MissingConfigurationException,
} from '../../common/exceptions';
import { GitlabClientService } from '../gitlab/gitlab-client.service';
import { SettingsService } from '../settings/settings.service';
import { Project } from './entities/project.entity';
import { ProjectsService } from './projects.service';

describe('ProjectsService', () => {
  let service: ProjectsService;
  const row = (overrides: Partial<Project> = {}): Project => ({
    id: 1,
    gitlabProjectId: 42,
    pathWithNamespace: 'equipe/backend-api',
    alias: 'api',
    webUrl: 'https://gitlab.com/equipe/backend-api',
    enabled: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  });
  const repository = {
    find: jest.fn(),
    findBy: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
  };
  const settings = { getGitlabUrl: jest.fn(), getToken: jest.fn() };
  const gitlab = { getProject: jest.fn() };
  const gitlabProject = {
    id: 42,
    path_with_namespace: 'equipe/backend-api',
    web_url: 'https://gitlab.com/equipe/backend-api',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    repository.find.mockResolvedValue([]);
    repository.findBy.mockResolvedValue([]);
    repository.findOneBy.mockResolvedValue(null);
    repository.save.mockImplementation((p: Project) => Promise.resolve(p));
    repository.create.mockImplementation(
      (p: Partial<Project>) => ({ id: 1, ...p }) as Project,
    );
    settings.getGitlabUrl.mockResolvedValue('https://gitlab.com');
    settings.getToken.mockResolvedValue('glpat-token-value');
    gitlab.getProject.mockResolvedValue(gitlabProject);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: getRepositoryToken(Project), useValue: repository },
        { provide: SettingsService, useValue: settings },
        { provide: GitlabClientService, useValue: gitlab },
      ],
    }).compile();
    service = moduleRef.get(ProjectsService);
  });

  describe('list', () => {
    it('should_return_projects_ordered_by_id', async () => {
      repository.find.mockResolvedValue([row(), row({ id: 2, alias: 'web' })]);

      await expect(service.list()).resolves.toEqual([
        {
          id: 1,
          pathWithNamespace: 'equipe/backend-api',
          alias: 'api',
          gitlabProjectId: 42,
        },
        {
          id: 2,
          pathWithNamespace: 'equipe/backend-api',
          alias: 'web',
          gitlabProjectId: 42,
        },
      ]);
      expect(repository.find).toHaveBeenCalledWith({ order: { id: 'ASC' } });
    });
  });

  describe('listActive', () => {
    it('should_return_only_enabled_projects_ordered_by_id', async () => {
      repository.find.mockResolvedValue([row()]);

      await expect(service.listActive()).resolves.toEqual([row()]);
      expect(repository.find).toHaveBeenCalledWith({
        where: { enabled: true },
        order: { id: 'ASC' },
      });
    });
  });

  describe('findById', () => {
    it('should_return_the_raw_entity', async () => {
      repository.findOneBy.mockResolvedValue(row());

      await expect(service.findById(1)).resolves.toEqual(row());
      expect(repository.findOneBy).toHaveBeenCalledWith({ id: 1 });
    });

    it('should_return_null_for_an_unknown_id', async () => {
      await expect(service.findById(99)).resolves.toBeNull();
    });
  });

  describe('findByIds', () => {
    it('should_return_matching_entities', async () => {
      repository.findBy.mockResolvedValue([
        row(),
        row({ id: 2, alias: 'web' }),
      ]);

      await expect(service.findByIds([1, 2])).resolves.toEqual([
        row(),
        row({ id: 2, alias: 'web' }),
      ]);
      expect(repository.findBy).toHaveBeenCalledWith({ id: In([1, 2]) });
    });

    it('should_not_query_when_the_id_list_is_empty', async () => {
      await expect(service.findByIds([])).resolves.toEqual([]);
      expect(repository.findBy).not.toHaveBeenCalled();
    });
  });

  describe('add', () => {
    it('should_resolve_and_store_project_with_explicit_alias', async () => {
      const result = await service.add({
        path: 'equipe/backend-api',
        alias: 'api',
      });

      expect(gitlab.getProject).toHaveBeenCalledWith(
        'https://gitlab.com',
        'glpat-token-value',
        'equipe/backend-api',
      );
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          gitlabProjectId: 42,
          pathWithNamespace: 'equipe/backend-api',
          alias: 'api',
          webUrl: 'https://gitlab.com/equipe/backend-api',
        }),
      );
      expect(result).toEqual({
        id: 1,
        pathWithNamespace: 'equipe/backend-api',
        alias: 'api',
        gitlabProjectId: 42,
      });
    });

    it('should_derive_alias_from_path_when_omitted', async () => {
      const result = await service.add({
        path: 'https://gitlab.com/equipe/backend-api/',
      });

      expect(result.alias).toBe('backend-api');
    });

    it('should_reject_unresolvable_path', async () => {
      await expect(service.add({ path: '   ' })).rejects.toBeInstanceOf(
        BusinessValidationException,
      );
      expect(gitlab.getProject).not.toHaveBeenCalled();
    });

    it('should_throw_409_without_token', async () => {
      settings.getToken.mockResolvedValue(null);

      await expect(
        service.add({ path: 'equipe/backend-api' }),
      ).rejects.toBeInstanceOf(MissingConfigurationException);
      expect(gitlab.getProject).not.toHaveBeenCalled();
    });

    it('should_reject_when_project_not_found', async () => {
      gitlab.getProject.mockResolvedValue(null);

      await expect(
        service.add({ path: 'equipe/inexistant' }),
      ).rejects.toBeInstanceOf(BusinessValidationException);
    });

    it('should_reject_when_gitlab_denies_access', async () => {
      gitlab.getProject.mockRejectedValue(new GitlabAuthException());

      await expect(
        service.add({ path: 'equipe/prive' }),
      ).rejects.toBeInstanceOf(BusinessValidationException);
    });

    it('should_propagate_gitlab_unavailable', async () => {
      gitlab.getProject.mockRejectedValue(new GitlabUnavailableException());

      await expect(
        service.add({ path: 'equipe/backend-api' }),
      ).rejects.toBeInstanceOf(GitlabUnavailableException);
    });

    it('should_reject_when_project_already_configured', async () => {
      repository.findOneBy.mockResolvedValue(row());

      const error: unknown = await service
        .add({ path: 'equipe/backend-api' })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).getStatus()).toBe(409);
      expect((error as BusinessException).code).toBe(
        'projects.alreadyConfigured',
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should_reject_explicit_alias_duplicate_case_insensitively', async () => {
      repository.find.mockResolvedValue([row({ alias: 'api' })]);

      await expect(
        service.add({ path: 'autre/projet', alias: 'API' }),
      ).rejects.toBeInstanceOf(BusinessValidationException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should_reject_default_alias_duplicate', async () => {
      repository.find.mockResolvedValue([row({ alias: 'backend-api' })]);

      await expect(
        service.add({ path: 'autre-equipe/backend-api' }),
      ).rejects.toBeInstanceOf(BusinessValidationException);
    });
  });

  describe('rename', () => {
    it('should_update_alias', async () => {
      repository.findOneBy.mockResolvedValue(row());

      const result = await service.rename(1, { alias: 'back' });

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ alias: 'back' }),
      );
      expect(result.alias).toBe('back');
    });

    it('should_throw_404_for_unknown_id', async () => {
      await expect(service.rename(99, { alias: 'x' })).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });

    it('should_reject_duplicate_alias_excluding_itself', async () => {
      repository.findOneBy.mockResolvedValue(row({ id: 2, alias: 'web' }));
      repository.find.mockResolvedValue([
        row({ id: 2, alias: 'web' }),
        row({ id: 1, alias: 'api' }),
      ]);

      await expect(service.rename(2, { alias: 'api' })).rejects.toBeInstanceOf(
        BusinessValidationException,
      );
    });

    it('should_allow_renaming_to_its_own_current_alias', async () => {
      repository.findOneBy.mockResolvedValue(row());
      repository.find.mockResolvedValue([row()]);

      await expect(service.rename(1, { alias: 'api' })).resolves.toEqual(
        expect.objectContaining({ alias: 'api' }),
      );
    });
  });

  describe('importMany', () => {
    it('should_add_a_new_repo_resolved_against_gitlab', async () => {
      const result = await service.importMany([
        { pathWithNamespace: 'equipe/backend-api', alias: 'api' },
      ]);

      expect(gitlab.getProject).toHaveBeenCalledWith(
        'https://gitlab.com',
        'glpat-token-value',
        'equipe/backend-api',
      );
      expect(result).toEqual({ added: 1, updated: 0, skipped: [] });
    });

    it('should_update_the_alias_of_an_existing_repo_matched_by_path', async () => {
      const existing = row({
        id: 5,
        pathWithNamespace: 'equipe/backend-api',
        alias: 'old-alias',
      });
      repository.find.mockResolvedValue([existing]);
      repository.findOneBy.mockResolvedValue(existing);

      const result = await service.importMany([
        { pathWithNamespace: 'equipe/backend-api', alias: 'new-alias' },
      ]);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 5, alias: 'new-alias' }),
      );
      expect(gitlab.getProject).not.toHaveBeenCalled();
      expect(result).toEqual({ added: 0, updated: 1, skipped: [] });
    });

    it('should_match_paths_case_insensitively', async () => {
      const existing = row({
        id: 5,
        pathWithNamespace: 'Equipe/Backend-API',
        alias: 'old-alias',
      });
      repository.find.mockResolvedValue([existing]);
      repository.findOneBy.mockResolvedValue(existing);

      const result = await service.importMany([
        { pathWithNamespace: 'equipe/backend-api', alias: 'new-alias' },
      ]);

      expect(result.updated).toBe(1);
    });

    it('should_collect_a_repo_not_found_on_gitlab_in_skipped_without_aborting_the_import', async () => {
      gitlab.getProject.mockImplementation(
        (_url: string, _token: string, path: string) =>
          Promise.resolve(path === 'equipe/backend-api' ? gitlabProject : null),
      );

      const result = await service.importMany([
        { pathWithNamespace: 'equipe/introuvable', alias: 'x' },
        { pathWithNamespace: 'equipe/backend-api', alias: 'api' },
      ]);

      expect(result.added).toBe(1);
      expect(result.skipped).toEqual([
        {
          pathWithNamespace: 'equipe/introuvable',
          reason: 'projects.notFound',
        },
      ]);
    });

    it('should_collect_an_alias_duplicate_in_skipped', async () => {
      repository.find.mockResolvedValue([
        row({ id: 9, alias: 'api', pathWithNamespace: 'other/project' }),
      ]);

      const result = await service.importMany([
        { pathWithNamespace: 'equipe/backend-api', alias: 'api' },
      ]);

      expect(result.added).toBe(0);
      expect(result.skipped).toEqual([
        {
          pathWithNamespace: 'equipe/backend-api',
          reason: 'projects.aliasDuplicate',
        },
      ]);
    });

    it('should_collect_a_missing_token_failure_in_skipped', async () => {
      settings.getToken.mockResolvedValue(null);

      const result = await service.importMany([
        { pathWithNamespace: 'equipe/backend-api', alias: 'api' },
      ]);

      expect(result.skipped).toEqual([
        {
          pathWithNamespace: 'equipe/backend-api',
          reason: 'settings.tokenMissing',
        },
      ]);
    });

    it('should_never_remove_a_repo_absent_from_the_entries', async () => {
      repository.find.mockResolvedValue([row()]);

      await service.importMany([]);

      expect(repository.remove).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should_remove_existing_project', async () => {
      const project = row();
      repository.findOneBy.mockResolvedValue(project);

      await service.remove(1);

      expect(repository.remove).toHaveBeenCalledWith(project);
    });

    it('should_throw_404_for_unknown_id', async () => {
      await expect(service.remove(99)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
      expect(repository.remove).not.toHaveBeenCalled();
    });
  });
});
