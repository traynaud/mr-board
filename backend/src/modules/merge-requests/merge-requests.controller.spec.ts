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

  it('should_delegate_to_the_service_with_defaults_when_no_query_param_is_given', async () => {
    const response = { mergeRequests: [{ id: 1 }], warnings: [] };
    service.listOpen.mockResolvedValue(response);

    await expect(controller.list({})).resolves.toBe(response);
    expect(service.listOpen).toHaveBeenCalledWith({
      sort: undefined,
      includeDrafts: false,
      mineOnly: false,
    });
  });

  it('should_pass_the_sort_query_param_through_to_the_service', async () => {
    const response = { mergeRequests: [{ id: 1 }], warnings: [] };
    service.listOpen.mockResolvedValue(response);

    await expect(controller.list({ sort: 'diff:desc' })).resolves.toBe(
      response,
    );
    expect(service.listOpen).toHaveBeenCalledWith({
      sort: 'diff:desc',
      includeDrafts: false,
      mineOnly: false,
    });
  });

  it('should_translate_drafts_and_mine_query_params_to_booleans', async () => {
    const response = { mergeRequests: [], warnings: [] };
    service.listOpen.mockResolvedValue(response);

    await controller.list({ drafts: '1', mine: '1' });

    expect(service.listOpen).toHaveBeenCalledWith({
      sort: undefined,
      includeDrafts: true,
      mineOnly: true,
    });
  });
});
