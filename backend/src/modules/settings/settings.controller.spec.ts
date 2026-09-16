import { Test } from '@nestjs/testing';
import { SettingsController } from './settings.controller.js';
import { SettingsService } from './settings.service.js';

describe('SettingsController', () => {
  let controller: SettingsController;
  const service = {
    get: jest.fn(),
    update: jest.fn(),
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
    const dto = { theme: 'system' };
    service.get.mockResolvedValue(dto);

    await expect(controller.getSettings()).resolves.toBe(dto);
  });

  it('should_update_settings', async () => {
    const body = { highlightMe: false };
    service.update.mockResolvedValue({ highlightMe: false });

    await expect(controller.putSettings(body)).resolves.toEqual({
      highlightMe: false,
    });
    expect(service.update).toHaveBeenCalledWith(body);
  });
});
