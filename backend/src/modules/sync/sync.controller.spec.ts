import { Test } from '@nestjs/testing';
import { SyncController } from './sync.controller.js';
import { SyncService } from './sync.service.js';

describe('SyncController', () => {
  let controller: SyncController;
  const syncService = {
    trigger: jest.fn(),
    getStatus: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [SyncController],
      providers: [{ provide: SyncService, useValue: syncService }],
    }).compile();
    controller = module.get(SyncController);
  });

  it('should_trigger_a_manual_sync_without_a_project_id', async () => {
    syncService.trigger.mockResolvedValue({ running: true });

    await expect(controller.trigger(undefined)).resolves.toEqual({
      running: true,
    });
    expect(syncService.trigger).toHaveBeenCalledWith('manual', undefined);
  });

  it('should_forward_the_project_id_to_a_targeted_sync', async () => {
    syncService.trigger.mockResolvedValue({ running: true });

    await controller.trigger(3);

    expect(syncService.trigger).toHaveBeenCalledWith('manual', 3);
  });

  it('should_return_the_sync_status', async () => {
    const status = { running: false, lastRun: null, nextRunAt: null };
    syncService.getStatus.mockResolvedValue(status);

    await expect(controller.getStatus()).resolves.toEqual(status);
  });
});
