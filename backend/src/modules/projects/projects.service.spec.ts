import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import {
  BusinessException,
  BusinessValidationException,
  ConnectionMissingException,
  ConnectionTokenMissingException,
  EntityNotFoundException,
  ForgeAuthException,
  ForgeUnavailableException,
} from '../../common/exceptions/index.js';
import { ConnectionsService } from '../connections/connections.service.js';
import { ForgeClientFactory } from '../forges/forge-client.factory.js';
import { Project } from './entities/project.entity.js';
import { ProjectsService } from './projects.service.js';

describe('ProjectsService', () => {
  let service: ProjectsService;
  const row = (overrides: Partial<Project> = {}): Project => ({
    id: 1,
    connectionId: 1,
    remoteProjectId: '42',
    pathWithNamespace: 'equipe/backend-api',
    alias: 'api',
    webUrl: 'https://gitlab.com/equipe/backend-api',
    enabled: true,
    color: null,
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
  const connectionRow = {
    id: 1,
    type: 'gitlab' as const,
    name: 'GitLab',
    url: 'https://gitlab.com',
  };
  const connections = {
    findAll: jest.fn(),
    findOrThrow: jest.fn(),
    getToken: jest.fn(),
  };
  const gitlabForge = { resolveProject: jest.fn(), normalizePath: jest.fn() };
  const forges = { forType: jest.fn() };
  const forgeProject = {
    remoteProjectId: '42',
    pathWithNamespace: 'equipe/backend-api',
    webUrl: 'https://gitlab.com/equipe/backend-api',
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
    connections.findAll.mockResolvedValue([connectionRow]);
    connections.findOrThrow.mockResolvedValue(connectionRow);
    connections.getToken.mockResolvedValue('glpat-token-value');
    gitlabForge.resolveProject.mockResolvedValue(forgeProject);
    gitlabForge.normalizePath.mockImplementation(
      (path: string) => path.trim() || null,
    );
    forges.forType.mockReturnValue(gitlabForge);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: getRepositoryToken(Project), useValue: repository },
        { provide: ConnectionsService, useValue: connections },
        { provide: ForgeClientFactory, useValue: forges },
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
          connectionId: 1,
          pathWithNamespace: 'equipe/backend-api',
          alias: 'api',
          remoteProjectId: '42',
          color: null,
        },
        {
          id: 2,
          connectionId: 1,
          pathWithNamespace: 'equipe/backend-api',
          alias: 'web',
          remoteProjectId: '42',
          color: null,
        },
      ]);
      expect(repository.find).toHaveBeenCalledWith({ order: { id: 'ASC' } });
    });
  });

  describe('listActiveByConnection', () => {
    it('should_return_only_enabled_projects_of_that_connection', async () => {
      repository.find.mockResolvedValue([row()]);

      await expect(service.listActiveByConnection(1)).resolves.toEqual([row()]);
      expect(repository.find).toHaveBeenCalledWith({
        where: { connectionId: 1, enabled: true },
        order: { id: 'ASC' },
      });
    });
  });

  describe('findById', () => {
    it('should_return_the_raw_entity', async () => {
      repository.findOneBy.mockResolvedValue(row());

      await expect(service.findById(1)).resolves.toEqual(row());
    });

    it('should_return_null_for_an_unknown_id', async () => {
      await expect(service.findById(99)).resolves.toBeNull();
    });
  });

  describe('findByIds', () => {
    it('should_return_matching_entities', async () => {
      repository.findBy.mockResolvedValue([row()]);

      await expect(service.findByIds([1])).resolves.toEqual([row()]);
      expect(repository.findBy).toHaveBeenCalledWith({ id: In([1]) });
    });

    it('should_not_query_when_the_id_list_is_empty', async () => {
      await expect(service.findByIds([])).resolves.toEqual([]);
      expect(repository.findBy).not.toHaveBeenCalled();
    });
  });

  describe('add', () => {
    it('should_resolve_and_store_project_using_the_sole_connection', async () => {
      const result = await service.add({
        path: 'equipe/backend-api',
        alias: 'api',
      });

      expect(gitlabForge.resolveProject).toHaveBeenCalledWith(
        'https://gitlab.com',
        'glpat-token-value',
        'equipe/backend-api',
      );
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionId: 1,
          remoteProjectId: '42',
          pathWithNamespace: 'equipe/backend-api',
          alias: 'api',
        }),
      );
      expect(result).toEqual({
        id: 1,
        connectionId: 1,
        pathWithNamespace: 'equipe/backend-api',
        alias: 'api',
        remoteProjectId: '42',
        color: null,
      });
    });

    it('should_store_the_given_color_rg_025_07', async () => {
      const result = await service.add({
        path: 'equipe/backend-api',
        alias: 'api',
        color: 'sage',
      });

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ color: 'sage' }),
      );
      expect(result.color).toBe('sage');
    });

    it('should_default_color_to_null_when_omitted_rg_025_01', async () => {
      const result = await service.add({
        path: 'equipe/backend-api',
        alias: 'api',
      });

      expect(result.color).toBeNull();
    });

    it('should_use_the_explicit_connectionId_when_given', async () => {
      connections.findAll.mockResolvedValue([
        connectionRow,
        { id: 2, type: 'gitlab' as const, url: 'https://gitlab.exemple.fr' },
      ]);
      connections.findOrThrow.mockResolvedValue({
        id: 2,
        type: 'gitlab',
        url: 'https://gitlab.exemple.fr',
      });

      await service.add({ path: 'equipe/backend-api', connectionId: 2 });

      expect(gitlabForge.resolveProject).toHaveBeenCalledWith(
        'https://gitlab.exemple.fr',
        'glpat-token-value',
        'equipe/backend-api',
      );
    });

    it('should_require_connectionId_when_more_than_one_connection_exists', async () => {
      connections.findAll.mockResolvedValue([
        connectionRow,
        { id: 2, type: 'gitlab' as const, url: 'https://gitlab.exemple.fr' },
      ]);

      await expect(
        service.add({ path: 'equipe/backend-api' }),
      ).rejects.toBeInstanceOf(BusinessValidationException);
      expect(gitlabForge.resolveProject).not.toHaveBeenCalled();
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
      expect(gitlabForge.resolveProject).not.toHaveBeenCalled();
    });

    it('should_normalise_the_path_through_the_connections_own_forge_after_resolving_it', async () => {
      // RG-020-05 : chaque forge valide/normalise le chemin à sa façon
      // (GitHub exige `owner/repo`) — la connexion doit donc être résolue
      // avant que `normalizePath` ne soit appelé.
      await service.add({ path: 'equipe/backend-api' });

      expect(gitlabForge.normalizePath).toHaveBeenCalledWith(
        'equipe/backend-api',
      );
      expect(connections.findOrThrow).toHaveBeenCalled();
    });

    it('should_propagate_a_business_exception_thrown_by_the_forges_own_path_validation', async () => {
      gitlabForge.normalizePath.mockImplementation(() => {
        throw new BusinessValidationException(
          'projects.invalidPath',
          'Expected format: owner/repo',
        );
      });

      await expect(
        service.add({ path: 'equipe/sous/backend-api' }),
      ).rejects.toBeInstanceOf(BusinessValidationException);
      expect(gitlabForge.resolveProject).not.toHaveBeenCalled();
    });

    it('should_throw_409_when_no_connection_exists', async () => {
      connections.findAll.mockResolvedValue([]);

      await expect(
        service.add({ path: 'equipe/backend-api' }),
      ).rejects.toBeInstanceOf(ConnectionMissingException);
      expect(gitlabForge.resolveProject).not.toHaveBeenCalled();
    });

    it('should_throw_409_when_the_connection_has_no_token', async () => {
      connections.getToken.mockResolvedValue(null);

      await expect(
        service.add({ path: 'equipe/backend-api' }),
      ).rejects.toBeInstanceOf(ConnectionTokenMissingException);
      expect(gitlabForge.resolveProject).not.toHaveBeenCalled();
    });

    it('should_reject_when_project_not_found', async () => {
      gitlabForge.resolveProject.mockResolvedValue(null);

      await expect(
        service.add({ path: 'equipe/inexistant' }),
      ).rejects.toBeInstanceOf(BusinessValidationException);
    });

    it('should_reject_when_the_forge_denies_access', async () => {
      gitlabForge.resolveProject.mockRejectedValue(new ForgeAuthException());

      await expect(
        service.add({ path: 'equipe/prive' }),
      ).rejects.toBeInstanceOf(BusinessValidationException);
    });

    it('should_propagate_forge_unavailable', async () => {
      gitlabForge.resolveProject.mockRejectedValue(
        new ForgeUnavailableException(),
      );

      await expect(
        service.add({ path: 'equipe/backend-api' }),
      ).rejects.toBeInstanceOf(ForgeUnavailableException);
    });

    it('should_reject_when_project_already_configured_on_this_connection', async () => {
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

      const result = await service.rename(1, { alias: 'back', color: null });

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ alias: 'back' }),
      );
      expect(result.alias).toBe('back');
    });

    it('should_throw_404_for_unknown_id', async () => {
      await expect(
        service.rename(99, { alias: 'x', color: null }),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });

    it('should_reject_duplicate_alias_excluding_itself', async () => {
      repository.findOneBy.mockResolvedValue(row({ id: 2, alias: 'web' }));
      repository.find.mockResolvedValue([
        row({ id: 2, alias: 'web' }),
        row({ id: 1, alias: 'api' }),
      ]);

      await expect(
        service.rename(2, { alias: 'api', color: null }),
      ).rejects.toBeInstanceOf(BusinessValidationException);
    });

    it('should_allow_renaming_to_its_own_current_alias', async () => {
      repository.findOneBy.mockResolvedValue(row());
      repository.find.mockResolvedValue([row()]);

      await expect(
        service.rename(1, { alias: 'api', color: null }),
      ).resolves.toEqual(expect.objectContaining({ alias: 'api' }));
    });

    it('should_update_the_color_rg_025_07', async () => {
      repository.findOneBy.mockResolvedValue(row({ color: 'sage' }));

      const result = await service.rename(1, { alias: 'api', color: 'peach' });

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ color: 'peach' }),
      );
      expect(result.color).toBe('peach');
    });

    it('should_clear_the_color_back_to_none_rg_025_01', async () => {
      repository.findOneBy.mockResolvedValue(row({ color: 'sage' }));

      const result = await service.rename(1, { alias: 'api', color: null });

      expect(result.color).toBeNull();
    });
  });

  describe('importMany', () => {
    it('should_add_a_new_repo_resolved_against_the_named_connection', async () => {
      const result = await service.importMany([
        {
          pathWithNamespace: 'equipe/backend-api',
          alias: 'api',
          connectionName: 'GitLab',
        },
      ]);

      expect(gitlabForge.resolveProject).toHaveBeenCalledWith(
        'https://gitlab.com',
        'glpat-token-value',
        'equipe/backend-api',
      );
      expect(result).toEqual({ added: 1, updated: 0, skipped: [] });
    });

    it('should_update_the_alias_of_an_existing_repo_matched_by_path_and_connection', async () => {
      const existing = row({
        id: 5,
        pathWithNamespace: 'equipe/backend-api',
        alias: 'old-alias',
      });
      repository.find.mockResolvedValue([existing]);
      repository.findOneBy.mockResolvedValue(existing);

      const result = await service.importMany([
        {
          pathWithNamespace: 'equipe/backend-api',
          alias: 'new-alias',
          connectionName: 'GitLab',
        },
      ]);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 5, alias: 'new-alias' }),
      );
      expect(gitlabForge.resolveProject).not.toHaveBeenCalled();
      expect(result).toEqual({ added: 0, updated: 1, skipped: [] });
    });

    it('should_match_connection_names_case_insensitively', async () => {
      const result = await service.importMany([
        {
          pathWithNamespace: 'equipe/backend-api',
          alias: 'api',
          connectionName: 'GITLAB',
        },
      ]);

      expect(result.added).toBe(1);
    });

    it('should_skip_an_entry_naming_an_unknown_connection', async () => {
      const result = await service.importMany([
        {
          pathWithNamespace: 'equipe/backend-api',
          alias: 'api',
          connectionName: 'inexistante',
        },
      ]);

      expect(result).toEqual({
        added: 0,
        updated: 0,
        skipped: [
          {
            pathWithNamespace: 'equipe/backend-api',
            reason: 'connections.unknown',
          },
        ],
      });
      expect(gitlabForge.resolveProject).not.toHaveBeenCalled();
    });

    it('should_collect_a_missing_token_failure_in_skipped', async () => {
      connections.getToken.mockResolvedValue(null);

      const result = await service.importMany([
        {
          pathWithNamespace: 'equipe/backend-api',
          alias: 'api',
          connectionName: 'GitLab',
        },
      ]);

      expect(result.skipped).toEqual([
        {
          pathWithNamespace: 'equipe/backend-api',
          reason: 'connections.tokenMissing',
        },
      ]);
    });

    it('should_never_remove_a_repo_absent_from_the_entries', async () => {
      repository.find.mockResolvedValue([row()]);

      await service.importMany([]);

      expect(repository.remove).not.toHaveBeenCalled();
    });

    it('should_store_the_entrys_color_for_a_newly_added_repo_rg_025_08', async () => {
      await service.importMany([
        {
          pathWithNamespace: 'equipe/backend-api',
          alias: 'api',
          connectionName: 'GitLab',
          color: 'sage',
        },
      ]);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ color: 'sage' }),
      );
    });

    it('should_overwrite_a_matched_repos_color_when_the_entry_carries_one_rg_025_08', async () => {
      const existing = row({ id: 5, color: 'sage' });
      repository.find.mockResolvedValue([existing]);
      repository.findOneBy.mockResolvedValue(existing);

      await service.importMany([
        {
          pathWithNamespace: 'equipe/backend-api',
          alias: 'api',
          connectionName: 'GitLab',
          color: 'peach',
        },
      ]);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 5, color: 'peach' }),
      );
    });

    it('should_clear_a_matched_repos_color_when_the_entry_explicitly_carries_null_rg_025_08', async () => {
      const existing = row({ id: 5, color: 'sage' });
      repository.find.mockResolvedValue([existing]);
      repository.findOneBy.mockResolvedValue(existing);

      await service.importMany([
        {
          pathWithNamespace: 'equipe/backend-api',
          alias: 'api',
          connectionName: 'GitLab',
          color: null,
        },
      ]);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 5, color: null }),
      );
    });

    it('should_keep_a_matched_repos_existing_color_when_the_entry_has_no_color_field_rg_025_08', async () => {
      // Fichier exporté par une version antérieure à US-025 (v1 legacy) : la
      // clé `color` est absente de l'entrée, pas seulement `null`.
      const existing = row({ id: 5, color: 'sage' });
      repository.find.mockResolvedValue([existing]);
      repository.findOneBy.mockResolvedValue(existing);

      await service.importMany([
        {
          pathWithNamespace: 'equipe/backend-api',
          alias: 'api',
          connectionName: 'GitLab',
        },
      ]);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 5, color: 'sage' }),
      );
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
