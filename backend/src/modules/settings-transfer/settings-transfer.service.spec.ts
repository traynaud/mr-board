import { Test } from '@nestjs/testing';
import { ConnectionsService } from '../connections/connections.service.js';
import { FavoritesService } from '../favorites/favorites.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { ImportConfigDto } from './dto/import-config.dto.js';
import { SettingsTransferService } from './settings-transfer.service.js';

describe('SettingsTransferService', () => {
  let service: SettingsTransferService;
  const settings = {
    getExportableSettings: jest.fn(),
    applyImportedSettings: jest.fn(),
  };
  const connections = {
    findAll: jest.fn(),
    importUpsert: jest.fn(),
  };
  const projects = {
    list: jest.fn(),
    importMany: jest.fn(),
  };
  const favorites = {
    list: jest.fn(),
    add: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    connections.importUpsert.mockResolvedValue({
      name: 'GitLab',
      created: false,
    });
    connections.findAll.mockResolvedValue([]);
    projects.list.mockResolvedValue([]);
    favorites.list.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        SettingsTransferService,
        { provide: SettingsService, useValue: settings },
        { provide: ConnectionsService, useValue: connections },
        { provide: ProjectsService, useValue: projects },
        { provide: FavoritesService, useValue: favorites },
      ],
    }).compile();
    service = moduleRef.get(SettingsTransferService);
  });

  describe('export', () => {
    it('should_combine_exportable_settings_connections_and_repo_list', async () => {
      settings.getExportableSettings.mockResolvedValue({
        meEmail: 'marie@exemple.fr',
      });
      connections.findAll.mockResolvedValue([
        {
          id: 1,
          type: 'gitlab',
          name: 'GitLab',
          url: 'https://gitlab.com',
          meUsername: 'mdupont',
        },
      ]);
      projects.list.mockResolvedValue([
        {
          id: 1,
          connectionId: 1,
          pathWithNamespace: 'equipe/backend-api',
          alias: 'api',
          remoteProjectId: '42',
          color: 'sage',
        },
      ]);

      const result = await service.export();

      expect(result).toEqual({
        version: 2,
        settings: { meEmail: 'marie@exemple.fr' },
        connections: [
          {
            type: 'gitlab',
            name: 'GitLab',
            url: 'https://gitlab.com',
            meUsername: 'mdupont',
          },
        ],
        projects: [
          {
            connection: 'GitLab',
            pathWithNamespace: 'equipe/backend-api',
            alias: 'api',
            color: 'sage',
          },
        ],
        favorites: [],
      });
    });

    it('should_include_favorites_resolved_to_their_connection_and_repo_path_rg_027_15', async () => {
      settings.getExportableSettings.mockResolvedValue({});
      connections.findAll.mockResolvedValue([
        {
          id: 1,
          type: 'gitlab',
          name: 'GitLab',
          url: 'https://gitlab.com',
          meUsername: 'mdupont',
        },
      ]);
      projects.list.mockResolvedValue([
        {
          id: 5,
          connectionId: 1,
          pathWithNamespace: 'equipe/backend-api',
          alias: 'api',
          remoteProjectId: '42',
          color: null,
        },
      ]);
      favorites.list.mockResolvedValue([
        { id: 1, projectId: 5, iid: 42, createdAt: '2026-09-01T00:00:00.000Z' },
      ]);

      const result = await service.export();

      expect(result.favorites).toEqual([
        {
          connection: 'GitLab',
          pathWithNamespace: 'equipe/backend-api',
          iid: 42,
        },
      ]);
    });

    it('should_silently_omit_a_favorite_whose_project_no_longer_exists', async () => {
      settings.getExportableSettings.mockResolvedValue({});
      connections.findAll.mockResolvedValue([]);
      projects.list.mockResolvedValue([]);
      favorites.list.mockResolvedValue([
        {
          id: 1,
          projectId: 999,
          iid: 42,
          createdAt: '2026-09-01T00:00:00.000Z',
        },
      ]);

      const result = await service.export();

      expect(result.favorites).toEqual([]);
    });
  });

  describe('import — version 1', () => {
    it('should_apply_settings_and_merge_the_legacy_connection_then_the_repos', async () => {
      const dto: ImportConfigDto = Object.assign(new ImportConfigDto(), {
        version: 1,
        settings: { gitlabUrl: 'https://gitlab.com', meUsername: 'mdupont' },
        projects: [{ pathWithNamespace: 'equipe/backend-api', alias: 'api' }],
      });
      settings.applyImportedSettings.mockResolvedValue({ meEmail: null });
      projects.importMany.mockResolvedValue({
        added: 1,
        updated: 0,
        skipped: [],
      });

      const result = await service.import(dto);

      expect(settings.applyImportedSettings).toHaveBeenCalledWith(dto.settings);
      expect(connections.importUpsert).toHaveBeenCalledWith({
        type: 'gitlab',
        name: 'GitLab',
        url: 'https://gitlab.com',
        meUsername: 'mdupont',
      });
      expect(projects.importMany).toHaveBeenCalledWith([
        {
          pathWithNamespace: 'equipe/backend-api',
          alias: 'api',
          connectionName: 'GitLab',
        },
      ]);
      expect(result).toEqual({
        settings: { meEmail: null },
        connectionsAdded: 0,
        connectionsUpdated: 1,
        newConnectionNames: [],
        projectsAdded: 1,
        projectsUpdated: 0,
        projectsSkipped: [],
      });
    });

    it('should_pass_a_null_username_when_absent', async () => {
      const dto: ImportConfigDto = Object.assign(new ImportConfigDto(), {
        version: 1,
        settings: { gitlabUrl: 'https://gitlab.com' },
        projects: [],
      });
      settings.applyImportedSettings.mockResolvedValue({ meEmail: null });
      projects.importMany.mockResolvedValue({
        added: 0,
        updated: 0,
        skipped: [],
      });

      await service.import(dto);

      expect(connections.importUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ meUsername: null }),
      );
    });
  });

  describe('import — version 2', () => {
    it('should_apply_settings_merge_every_connection_then_the_repos_by_connection_name', async () => {
      const dto: ImportConfigDto = Object.assign(new ImportConfigDto(), {
        version: 2,
        settings: { meEmail: 'marie@exemple.fr' },
        connections: [
          {
            type: 'gitlab',
            name: 'gitlab.com',
            url: 'https://gitlab.com',
            meUsername: 'mdupont',
          },
        ],
        projects: [
          {
            connection: 'gitlab.com',
            pathWithNamespace: 'equipe/backend-api',
            alias: 'api',
          },
        ],
      });
      settings.applyImportedSettings.mockResolvedValue({
        meEmail: 'marie@exemple.fr',
      });
      connections.importUpsert.mockResolvedValue({
        name: 'gitlab.com',
        created: true,
      });
      projects.importMany.mockResolvedValue({
        added: 1,
        updated: 0,
        skipped: [],
      });

      const result = await service.import(dto);

      expect(connections.importUpsert).toHaveBeenCalledWith({
        type: 'gitlab',
        name: 'gitlab.com',
        url: 'https://gitlab.com',
        meUsername: 'mdupont',
      });
      expect(projects.importMany).toHaveBeenCalledWith([
        {
          pathWithNamespace: 'equipe/backend-api',
          alias: 'api',
          connectionName: 'gitlab.com',
        },
      ]);
      expect(result.projectsAdded).toBe(1);
      expect(result.connectionsAdded).toBe(1);
      expect(result.connectionsUpdated).toBe(0);
      expect(result.newConnectionNames).toEqual(['gitlab.com']);
    });

    it('should_forward_the_entrys_color_to_importMany_rg_025_08', async () => {
      const dto: ImportConfigDto = Object.assign(new ImportConfigDto(), {
        version: 2,
        settings: {},
        projects: [
          {
            connection: 'gitlab.com',
            pathWithNamespace: 'equipe/backend-api',
            alias: 'api',
            color: 'peach',
          },
        ],
      });
      settings.applyImportedSettings.mockResolvedValue({ meEmail: null });
      projects.importMany.mockResolvedValue({
        added: 1,
        updated: 0,
        skipped: [],
      });

      await service.import(dto);

      expect(projects.importMany).toHaveBeenCalledWith([
        {
          pathWithNamespace: 'equipe/backend-api',
          alias: 'api',
          connectionName: 'gitlab.com',
          color: 'peach',
        },
      ]);
    });

    it('should_import_no_connection_when_the_array_is_absent', async () => {
      const dto: ImportConfigDto = Object.assign(new ImportConfigDto(), {
        version: 2,
        settings: {},
        projects: [],
      });
      settings.applyImportedSettings.mockResolvedValue({ meEmail: null });
      projects.importMany.mockResolvedValue({
        added: 0,
        updated: 0,
        skipped: [],
      });

      const result = await service.import(dto);

      expect(connections.importUpsert).not.toHaveBeenCalled();
      expect(result.connectionsAdded).toBe(0);
      expect(result.connectionsUpdated).toBe(0);
      expect(result.newConnectionNames).toEqual([]);
    });

    it('should_report_skipped_repos', async () => {
      const dto: ImportConfigDto = Object.assign(new ImportConfigDto(), {
        version: 2,
        settings: {},
        projects: [
          {
            connection: 'inexistante',
            pathWithNamespace: 'equipe/introuvable',
            alias: 'x',
          },
        ],
      });
      settings.applyImportedSettings.mockResolvedValue({ meEmail: null });
      projects.importMany.mockResolvedValue({
        added: 0,
        updated: 0,
        skipped: [
          {
            pathWithNamespace: 'equipe/introuvable',
            reason: 'connections.unknown',
          },
        ],
      });

      const result = await service.import(dto);

      expect(result.projectsSkipped).toEqual([
        {
          pathWithNamespace: 'equipe/introuvable',
          reason: 'connections.unknown',
        },
      ]);
    });

    it('should_add_a_favorite_resolved_by_connection_name_and_repo_path_rg_027_15', async () => {
      const dto: ImportConfigDto = Object.assign(new ImportConfigDto(), {
        version: 2,
        settings: {},
        projects: [],
        favorites: [
          {
            connection: 'gitlab.com',
            pathWithNamespace: 'equipe/backend-api',
            iid: 42,
          },
        ],
      });
      settings.applyImportedSettings.mockResolvedValue({ meEmail: null });
      projects.importMany.mockResolvedValue({
        added: 0,
        updated: 0,
        skipped: [],
      });
      connections.findAll.mockResolvedValue([{ id: 1, name: 'gitlab.com' }]);
      projects.list.mockResolvedValue([
        { id: 5, connectionId: 1, pathWithNamespace: 'equipe/backend-api' },
      ]);

      await service.import(dto);

      expect(favorites.add).toHaveBeenCalledWith(5, 42);
    });

    it('should_silently_ignore_a_favorite_whose_connection_is_unknown_rg_027_15', async () => {
      const dto: ImportConfigDto = Object.assign(new ImportConfigDto(), {
        version: 2,
        settings: {},
        projects: [],
        favorites: [
          {
            connection: 'inconnue',
            pathWithNamespace: 'equipe/backend-api',
            iid: 42,
          },
        ],
      });
      settings.applyImportedSettings.mockResolvedValue({ meEmail: null });
      projects.importMany.mockResolvedValue({
        added: 0,
        updated: 0,
        skipped: [],
      });
      connections.findAll.mockResolvedValue([]);
      projects.list.mockResolvedValue([]);

      await expect(service.import(dto)).resolves.toBeDefined();

      expect(favorites.add).not.toHaveBeenCalled();
    });

    it('should_silently_ignore_a_favorite_whose_repo_path_is_unknown_rg_027_15', async () => {
      const dto: ImportConfigDto = Object.assign(new ImportConfigDto(), {
        version: 2,
        settings: {},
        projects: [],
        favorites: [
          {
            connection: 'gitlab.com',
            pathWithNamespace: 'equipe/introuvable',
            iid: 42,
          },
        ],
      });
      settings.applyImportedSettings.mockResolvedValue({ meEmail: null });
      projects.importMany.mockResolvedValue({
        added: 0,
        updated: 0,
        skipped: [],
      });
      connections.findAll.mockResolvedValue([{ id: 1, name: 'gitlab.com' }]);
      projects.list.mockResolvedValue([
        { id: 5, connectionId: 1, pathWithNamespace: 'equipe/backend-api' },
      ]);

      await service.import(dto);

      expect(favorites.add).not.toHaveBeenCalled();
    });

    it('should_not_touch_favorites_when_the_array_is_absent', async () => {
      const dto: ImportConfigDto = Object.assign(new ImportConfigDto(), {
        version: 2,
        settings: {},
        projects: [],
      });
      settings.applyImportedSettings.mockResolvedValue({ meEmail: null });
      projects.importMany.mockResolvedValue({
        added: 0,
        updated: 0,
        skipped: [],
      });

      await service.import(dto);

      expect(favorites.add).not.toHaveBeenCalled();
      expect(connections.findAll).not.toHaveBeenCalled();
    });
  });
});
