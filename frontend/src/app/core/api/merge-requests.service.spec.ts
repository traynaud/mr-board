import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { apiBaseUrlInterceptor } from '../interceptors/api-base-url.interceptor';
import { EMPTY_COMPOSABLE_FILTERS } from '../../models/merge-request.model';
import { MergeRequestsService } from './merge-requests.service';

describe('MergeRequestsService', () => {
  let service: MergeRequestsService;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiBaseUrlInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(MergeRequestsService);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  describe('getMergeRequests', () => {
    it('should_get_merge_requests_with_the_sort_and_filters_query_params', async () => {
      const pending = firstValueFrom(
        service.getMergeRequests(
          { key: 'ready', direction: 'asc' },
          { drafts: false, mine: false, search: '' },
          EMPTY_COMPOSABLE_FILTERS,
        ),
      );
      const req = ctrl.expectOne(
        (r) =>
          r.url === '/api/v1/merge-requests' &&
          r.params.get('sort') === 'ready:asc' &&
          r.params.get('drafts') === '0' &&
          r.params.get('mine') === '0',
      );
      expect(req.request.method).toBe('GET');
      req.flush({
        mergeRequests: [
          {
            id: 1,
            projectAlias: 'api',
            iid: 7,
            title: 'Refonte facturation',
            webUrl: 'https://gitlab.com/equipe/api/-/merge_requests/7',
            author: { username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
            reviewers: [],
            assignees: [],
            approved: false,
            commentsCount: 0,
          },
        ],
        warnings: [],
      });

      await expect(pending).resolves.toEqual({
        mergeRequests: [expect.objectContaining({ projectAlias: 'api', iid: 7 })],
        warnings: [],
      });
    });

    it('should_combine_the_key_and_direction_into_a_single_sort_value', () => {
      service
        .getMergeRequests(
          { key: 'diff', direction: 'desc' },
          { drafts: false, mine: false, search: '' },
          EMPTY_COMPOSABLE_FILTERS,
        )
        .subscribe();

      const req = ctrl.expectOne(
        (r) => r.url === '/api/v1/merge-requests' && r.params.get('sort') === 'diff:desc',
      );
      req.flush({ mergeRequests: [], warnings: [] });
    });

    it('should_send_drafts_and_mine_as_1_when_active', () => {
      service
        .getMergeRequests(
          { key: 'ready', direction: 'asc' },
          { drafts: true, mine: true, search: '' },
          EMPTY_COMPOSABLE_FILTERS,
        )
        .subscribe();

      const req = ctrl.expectOne(
        (r) =>
          r.url === '/api/v1/merge-requests' &&
          r.params.get('drafts') === '1' &&
          r.params.get('mine') === '1',
      );
      req.flush({ mergeRequests: [], warnings: [] });
    });

    it('should_omit_composable_filter_params_when_they_are_empty_or_null', () => {
      service
        .getMergeRequests(
          { key: 'ready', direction: 'asc' },
          { drafts: false, mine: false, search: '' },
          EMPTY_COMPOSABLE_FILTERS,
        )
        .subscribe();

      const req = ctrl.expectOne(
        (r) =>
          r.url === '/api/v1/merge-requests' &&
          !r.params.has('connection') &&
          !r.params.has('project') &&
          !r.params.has('author') &&
          !r.params.has('assigned') &&
          !r.params.has('approved') &&
          !r.params.has('commented') &&
          !r.params.has('q'),
      );
      req.flush({ mergeRequests: [], warnings: [] });
    });

    it('should_send_q_when_search_is_not_empty_rg_026_10', () => {
      service
        .getMergeRequests(
          { key: 'ready', direction: 'asc' },
          { drafts: false, mine: false, search: 'facturation' },
          EMPTY_COMPOSABLE_FILTERS,
        )
        .subscribe();

      const req = ctrl.expectOne(
        (r) => r.url === '/api/v1/merge-requests' && r.params.get('q') === 'facturation',
      );
      req.flush({ mergeRequests: [], warnings: [] });
    });

    it('should_send_the_composable_filter_params_as_csv_or_0_1_when_active', () => {
      service
        .getMergeRequests(
          { key: 'ready', direction: 'asc' },
          { drafts: false, mine: false, search: '' },
          {
            connection: ['gitlab.com', 'github.com'],
            project: ['api', 'web'],
            author: ['mdupont'],
            assigned: ['nobody'],
            approved: 'yes',
            commented: 'no',
          },
        )
        .subscribe();

      const req = ctrl.expectOne(
        (r) =>
          r.url === '/api/v1/merge-requests' &&
          r.params.get('connection') === 'gitlab.com,github.com' &&
          r.params.get('project') === 'api,web' &&
          r.params.get('author') === 'mdupont' &&
          r.params.get('assigned') === 'nobody' &&
          r.params.get('approved') === '1' &&
          r.params.get('commented') === '0',
      );
      req.flush({ mergeRequests: [], warnings: [] });
    });
  });

  describe('getFacets', () => {
    it('should_get_facets_with_the_drafts_and_mine_query_params_but_no_sort', async () => {
      const pending = firstValueFrom(
        service.getFacets({ drafts: true, mine: false, search: '' }, EMPTY_COMPOSABLE_FILTERS),
      );
      const req = ctrl.expectOne(
        (r) =>
          r.url === '/api/v1/merge-requests/facets' &&
          r.params.get('drafts') === '1' &&
          r.params.get('mine') === '0' &&
          !r.params.has('sort'),
      );
      expect(req.request.method).toBe('GET');
      const facets = {
        connection: [],
        project: [],
        author: [],
        assigned: [{ value: 'nobody', label: 'Nobody', count: 0 }],
        approved: [
          { value: 'yes', label: 'Oui', count: 0 },
          { value: 'no', label: 'Non', count: 0 },
        ],
        commented: [
          { value: 'yes', label: 'Oui', count: 0 },
          { value: 'no', label: 'Non', count: 0 },
        ],
      };
      req.flush(facets);

      await expect(pending).resolves.toEqual(facets);
    });

    it('should_send_the_composable_filter_params_as_csv_or_0_1_when_active', () => {
      service
        .getFacets(
          { drafts: false, mine: false, search: '' },
          {
            connection: ['gitlab.com'],
            project: ['api'],
            author: [],
            assigned: [],
            approved: null,
            commented: 'yes',
          },
        )
        .subscribe();

      const req = ctrl.expectOne(
        (r) =>
          r.url === '/api/v1/merge-requests/facets' &&
          r.params.get('connection') === 'gitlab.com' &&
          r.params.get('project') === 'api' &&
          !r.params.has('author') &&
          !r.params.has('assigned') &&
          !r.params.has('approved') &&
          r.params.get('commented') === '1',
      );
      req.flush({
        connection: [],
        project: [],
        author: [],
        assigned: [],
        approved: [],
        commented: [],
      });
    });
  });
});
