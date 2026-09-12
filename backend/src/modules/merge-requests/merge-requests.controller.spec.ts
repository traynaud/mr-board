import { Test } from '@nestjs/testing';
import { MergeRequestsController } from './merge-requests.controller';
import { MergeRequestsService } from './merge-requests.service';

describe('MergeRequestsController', () => {
  let controller: MergeRequestsController;
  const service = { listOpen: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [MergeRequestsController],
      providers: [{ provide: MergeRequestsService, useValue: service }],
    }).compile();
    controller = module.get(MergeRequestsController);
  });

  it('should_delegate_to_the_service', async () => {
    const views = [{ id: 1 }];
    service.listOpen.mockResolvedValue(views);

    await expect(controller.list()).resolves.toBe(views);
    expect(service.listOpen).toHaveBeenCalledTimes(1);
  });
});
