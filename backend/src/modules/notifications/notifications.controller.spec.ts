import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

describe('NotificationsController', () => {
  const service = {
    list: jest.fn(),
    summary: jest.fn(),
    dismiss: jest.fn(),
    dismissAll: jest.fn(),
  };
  const controller = new NotificationsController(
    service as unknown as NotificationsService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('should_forward_the_limit_to_the_list', async () => {
    service.list.mockResolvedValue({ events: [], count: 0, revision: '0:0:0' });
    await controller.list({ limit: 10 });
    expect(service.list).toHaveBeenCalledWith(10);
  });

  it('should_return_the_summary', async () => {
    service.summary.mockResolvedValue({ count: 2, revision: '1:2:0' });
    await expect(controller.summary()).resolves.toEqual({
      count: 2,
      revision: '1:2:0',
    });
  });

  it('should_dismiss_one_event', async () => {
    service.dismiss.mockResolvedValue(undefined);
    await controller.dismiss(4);
    expect(service.dismiss).toHaveBeenCalledWith(4);
  });

  it('should_dismiss_all', async () => {
    service.dismissAll.mockResolvedValue({ dismissed: 3 });
    await expect(controller.dismissAll()).resolves.toEqual({ dismissed: 3 });
  });
});
