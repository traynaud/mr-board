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

  it('should_get_merge_requests', async () => {
    const pending = firstValueFrom(service.getMergeRequests());
    const req = ctrl.expectOne('/api/v1/merge-requests');
    expect(req.request.method).toBe('GET');
    req.flush([
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
    ]);

    await expect(pending).resolves.toEqual([
      expect.objectContaining({ projectAlias: 'api', iid: 7 }),
    ]);
  });
});
