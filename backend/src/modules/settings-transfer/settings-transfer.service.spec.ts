import { Test } from '@nestjs/testing';
import { ProjectsService } from '../projects/projects.service';
import { SettingsService } from '../settings/settings.service';
import { ImportConfigDto } from './dto/import-config.dto';
import { SettingsTransferService } from './settings-transfer.service';

describe('SettingsTransferService', () => {
  let service: SettingsTransferService;
  const settings = {
    getExportableSettings: jest.fn(),
    applyImportedSettings: jest.fn(),
  };
  const projects = {
    list: jest.fn(),
    importMany: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        SettingsTransferService,
        { provide: SettingsService, useValue: settings },
        { provide: ProjectsService, useValue: projects },
      ],
    }).compile();
    service = moduleRef.get(SettingsTransferService);
  });

  describe('export', () => {
    it('should_combine_exportable_settings_and_repo_list', async () => {
      settings.getExportableSettings.mockResolvedValue({
        gitlabUrl: 'https://gitlab.com',
        meUsername: 'mdupont',
      });
      projects.list.mockResolvedValue([
        {
          id: 1,
          pathWithNamespace: 'equipe/backend-api',
          alias: 'api',
          gitlabProjectId: 42,
        },
      ]);

      const result = await service.export();

      expect(result).toEqual({
        version: 1,
        settings: { gitlabUrl: 'https://gitlab.com', meUsername: 'mdupont' },
        projects: [{ pathWithNamespace: 'equipe/backend-api', alias: 'api' }],
      });
    });
  });

  describe('import', () => {
    it('should_apply_settings_then_merge_repos_and_combine_the_result', async () => {
      const dto: ImportConfigDto = Object.assign(new ImportConfigDto(), {
        version: 1,
        settings: { gitlabUrl: 'https://gitlab.com' },
        projects: [{ pathWithNamespace: 'equipe/backend-api', alias: 'api' }],
      });
      settings.applyImportedSettings.mockResolvedValue({
        gitlabUrl: 'https://gitlab.com',
      });
      projects.importMany.mockResolvedValue({
        added: 1,
        updated: 0,
        skipped: [],
      });

      const result = await service.import(dto);

      expect(settings.applyImportedSettings).toHaveBeenCalledWith(dto.settings);
      expect(projects.importMany).toHaveBeenCalledWith(dto.projects);
      expect(result).toEqual({
        settings: { gitlabUrl: 'https://gitlab.com' },
        projectsAdded: 1,
        projectsUpdated: 0,
        projectsSkipped: [],
      });
    });

    it('should_report_skipped_repos', async () => {
      const dto: ImportConfigDto = Object.assign(new ImportConfigDto(), {
        version: 1,
        settings: { gitlabUrl: 'https://gitlab.com' },
        projects: [{ pathWithNamespace: 'equipe/introuvable', alias: 'x' }],
      });
      settings.applyImportedSettings.mockResolvedValue({
        gitlabUrl: 'https://gitlab.com',
      });
      projects.importMany.mockResolvedValue({
        added: 0,
        updated: 0,
        skipped: [
          {
            pathWithNamespace: 'equipe/introuvable',
            reason: 'projects.notFound',
          },
        ],
      });

      const result = await service.import(dto);

      expect(result.projectsSkipped).toEqual([
        {
          pathWithNamespace: 'equipe/introuvable',
          reason: 'projects.notFound',
        },
      ]);
    });
  });
});
