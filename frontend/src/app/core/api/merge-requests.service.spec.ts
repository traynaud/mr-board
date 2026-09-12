import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { apiBaseUrlInterceptor } from '../interceptors/api-base-url.interceptor';
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

  it('should_get_merge_requests_with_the_sort_and_filters_query_params', async () => {
    const pending = firstValueFrom(
      service.getMergeRequests(
        { key: 'ready', direction: 'asc' },
        { drafts: false, mine: false },
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
      .getMergeRequests({ key: 'diff', direction: 'desc' }, { drafts: false, mine: false })
      .subscribe();

    const req = ctrl.expectOne(
      (r) => r.url === '/api/v1/merge-requests' && r.params.get('sort') === 'diff:desc',
    );
    req.flush({ mergeRequests: [], warnings: [] });
  });

  it('should_send_drafts_and_mine_as_1_when_active', () => {
    service
      .getMergeRequests({ key: 'ready', direction: 'asc' }, { drafts: true, mine: true })
      .subscribe();

    const req = ctrl.expectOne(
      (r) =>
        r.url === '/api/v1/merge-requests' &&
        r.params.get('drafts') === '1' &&
        r.params.get('mine') === '1',
    );
    req.flush({ mergeRequests: [], warnings: [] });
  });
});
