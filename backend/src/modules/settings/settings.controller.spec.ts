import { Test } from '@nestjs/testing';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

describe('SettingsController', () => {
  let controller: SettingsController;
  const service = {
    get: jest.fn(),
    update: jest.fn(),
    testConnection: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [{ provide: SettingsService, useValue: service }],
    }).compile();
    controller = moduleRef.get(SettingsController);
  });

  it('should_get_settings', async () => {
    const dto = {
      gitlabUrl: 'https://gitlab.com',
      tokenConfigured: false,
      tokenHint: null,
    };
    service.get.mockResolvedValue(dto);

    await expect(controller.getSettings()).resolves.toBe(dto);
  });

  it('should_update_settings', async () => {
    const body = {
      gitlabUrl: 'https://gitlab.com',
      gitlabToken: 'glpat-abcdwxyz',
    };
    service.update.mockResolvedValue({ tokenConfigured: true });

    await expect(controller.putSettings(body)).resolves.toEqual({
      tokenConfigured: true,
    });
    expect(service.update).toHaveBeenCalledWith(body);
  });

  it('should_test_connection', async () => {
    const body = { gitlabUrl: 'https://gitlab.com' };
    service.testConnection.mockResolvedValue({ username: 'mdupont' });

    await expect(controller.postTestConnection(body)).resolves.toEqual({
      username: 'mdupont',
    });
    expect(service.testConnection).toHaveBeenCalledWith(body);
  });
});
