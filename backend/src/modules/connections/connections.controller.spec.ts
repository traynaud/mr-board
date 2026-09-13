import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';

describe('ConnectionsController', () => {
  const service = {
    list: jest.fn(),
    add: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    test: jest.fn(),
  };
  const controller = new ConnectionsController(
    service as unknown as ConnectionsService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('should_delegate_list', async () => {
    service.list.mockResolvedValue([{ id: 1 }]);

    await expect(controller.list()).resolves.toEqual([{ id: 1 }]);
  });

  it('should_delegate_add', async () => {
    const dto = {
      type: 'gitlab' as const,
      name: 'x',
      url: 'https://gitlab.com',
      token: 'glpat-abcdwxyz',
    };
    service.add.mockResolvedValue({ id: 1 });

    await expect(controller.add(dto)).resolves.toEqual({ id: 1 });
    expect(service.add).toHaveBeenCalledWith(dto);
  });

  it('should_delegate_test', async () => {
    const dto = { connectionId: 1 };
    service.test.mockResolvedValue({ username: 'mdupont' });

    await expect(controller.test(dto)).resolves.toEqual({
      username: 'mdupont',
    });
    expect(service.test).toHaveBeenCalledWith(dto);
  });

  it('should_delegate_update', async () => {
    const dto = { name: 'new-name' };
    service.update.mockResolvedValue({ id: 1, name: 'new-name' });

    await expect(controller.update(1, dto)).resolves.toEqual({
      id: 1,
      name: 'new-name',
    });
    expect(service.update).toHaveBeenCalledWith(1, dto);
  });

  it('should_delegate_remove', async () => {
    await controller.remove(1);

    expect(service.remove).toHaveBeenCalledWith(1);
  });
});
