import { Test } from '@nestjs/testing';
import { EMPTY_COMPOSABLE_FILTERS } from './domain/filter-merge-requests';
import { MergeRequestsController } from './merge-requests.controller';
import { MergeRequestsService } from './merge-requests.service';

describe('MergeRequestsController', () => {
  let controller: MergeRequestsController;
  const service = {
    listOpen: jest.fn(),
    getFacets: jest.fn(),
    setFavorite: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [MergeRequestsController],
      providers: [{ provide: MergeRequestsService, useValue: service }],
    }).compile();
    controller = module.get(MergeRequestsController);
  });

  describe('list', () => {
    it('should_delegate_to_the_service_with_defaults_when_no_query_param_is_given', async () => {
      const response = { mergeRequests: [{ id: 1 }], warnings: [] };
      service.listOpen.mockResolvedValue(response);

      await expect(controller.list({})).resolves.toBe(response);
      expect(service.listOpen).toHaveBeenCalledWith({
        sort: undefined,
        includeDrafts: false,
        mineOnly: false,
        favoritesOnly: false,
        filters: EMPTY_COMPOSABLE_FILTERS,
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
        favoritesOnly: false,
        filters: EMPTY_COMPOSABLE_FILTERS,
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
        favoritesOnly: false,
        filters: EMPTY_COMPOSABLE_FILTERS,
      });
    });

    it('should_translate_the_fav_query_param_to_a_boolean_rg_027_11', async () => {
      const response = { mergeRequests: [], warnings: [] };
      service.listOpen.mockResolvedValue(response);

      await controller.list({ fav: '1' });

      expect(service.listOpen).toHaveBeenCalledWith(
        expect.objectContaining({ favoritesOnly: true }),
      );
    });

    it('should_translate_the_composable_filter_query_params_to_a_composable_filters_object', async () => {
      const response = { mergeRequests: [], warnings: [] };
      service.listOpen.mockResolvedValue(response);

      await controller.list({
        connection: ['gitlab.com'],
        project: ['api', 'web'],
        author: ['mdupont'],
        assigned: ['nobody'],
        approved: '1',
        commented: '0',
      });

      expect(service.listOpen).toHaveBeenCalledWith({
        sort: undefined,
        includeDrafts: false,
        mineOnly: false,
        favoritesOnly: false,
        filters: {
          connection: ['gitlab.com'],
          project: ['api', 'web'],
          author: ['mdupont'],
          assigned: ['nobody'],
          approved: 'yes',
          commented: 'no',
        },
      });
    });

    it('should_pass_the_q_query_param_through_as_search_rg_026', async () => {
      const response = { mergeRequests: [], warnings: [] };
      service.listOpen.mockResolvedValue(response);

      await controller.list({ q: 'facturation' });

      expect(service.listOpen).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'facturation' }),
      );
    });
  });

  describe('facets', () => {
    it('should_delegate_to_the_service_with_defaults_when_no_query_param_is_given', async () => {
      const response = {
        connection: [],
        project: [],
        author: [],
        assigned: [],
        approved: [],
        commented: [],
      };
      service.getFacets.mockResolvedValue(response);

      await expect(controller.facets({})).resolves.toBe(response);
      expect(service.getFacets).toHaveBeenCalledWith({
        includeDrafts: false,
        mineOnly: false,
        favoritesOnly: false,
        filters: EMPTY_COMPOSABLE_FILTERS,
      });
    });

    it('should_translate_drafts_mine_and_composable_filter_query_params', async () => {
      const response = {
        connection: [],
        project: [],
        author: [],
        assigned: [],
        approved: [],
        commented: [],
      };
      service.getFacets.mockResolvedValue(response);

      await controller.facets({
        drafts: '1',
        mine: '1',
        connection: ['github.com'],
        project: ['api'],
        approved: '0',
      });

      expect(service.getFacets).toHaveBeenCalledWith({
        includeDrafts: true,
        mineOnly: true,
        favoritesOnly: false,
        filters: {
          connection: ['github.com'],
          project: ['api'],
          author: [],
          assigned: [],
          approved: 'no',
          commented: null,
        },
      });
    });

    it('should_translate_the_fav_query_param_to_a_boolean_rg_027_11', async () => {
      const response = {
        connection: [],
        project: [],
        author: [],
        assigned: [],
        approved: [],
        commented: [],
      };
      service.getFacets.mockResolvedValue(response);

      await controller.facets({ fav: '1' });

      expect(service.getFacets).toHaveBeenCalledWith(
        expect.objectContaining({ favoritesOnly: true }),
      );
    });

    it('should_pass_the_q_query_param_through_as_search_rg_026', async () => {
      const response = {
        connection: [],
        project: [],
        author: [],
        assigned: [],
        approved: [],
        commented: [],
      };
      service.getFacets.mockResolvedValue(response);

      await controller.facets({ q: 'facturation' });

      expect(service.getFacets).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'facturation' }),
      );
    });
  });

  describe('markFavorite', () => {
    it('should_delegate_to_the_service_with_favorite_true_rg_027_08', async () => {
      service.setFavorite.mockResolvedValue(undefined);

      await controller.markFavorite(7);

      expect(service.setFavorite).toHaveBeenCalledWith(7, true);
    });
  });

  describe('unmarkFavorite', () => {
    it('should_delegate_to_the_service_with_favorite_false_rg_027_08', async () => {
      service.setFavorite.mockResolvedValue(undefined);

      await controller.unmarkFavorite(7);

      expect(service.setFavorite).toHaveBeenCalledWith(7, false);
    });
  });
});
