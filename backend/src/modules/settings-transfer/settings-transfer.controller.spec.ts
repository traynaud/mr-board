import { Test } from '@nestjs/testing';
import { ImportConfigDto } from './dto/import-config.dto.js';
import { SettingsTransferController } from './settings-transfer.controller.js';
import { SettingsTransferService } from './settings-transfer.service.js';

describe('SettingsTransferController', () => {
  let controller: SettingsTransferController;
  const service = { export: jest.fn(), import: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [SettingsTransferController],
      providers: [{ provide: SettingsTransferService, useValue: service }],
    }).compile();
    controller = moduleRef.get(SettingsTransferController);
  });

  it('should_get_export', async () => {
    const dto = { version: 2, settings: {}, connections: [], projects: [] };
    service.export.mockResolvedValue(dto);

    await expect(controller.getExport()).resolves.toBe(dto);
  });

  it('should_post_import', async () => {
    const body: ImportConfigDto = Object.assign(new ImportConfigDto(), {
      version: 1,
      settings: { gitlabUrl: 'https://gitlab.com' },
      projects: [],
    });
    service.import.mockResolvedValue({
      settings: {},
      projectsAdded: 0,
      projectsUpdated: 0,
      projectsSkipped: [],
    });

    await expect(controller.postImport(body)).resolves.toEqual({
      settings: {},
      projectsAdded: 0,
      projectsUpdated: 0,
      projectsSkipped: [],
    });
    expect(service.import).toHaveBeenCalledWith(body);
  });
});
