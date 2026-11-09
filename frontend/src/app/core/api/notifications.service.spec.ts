import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { apiBaseUrlInterceptor } from '../interceptors/api-base-url.interceptor';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiBaseUrlInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(NotificationsService);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  it('should_get_the_notifications', async () => {
    const pending = firstValueFrom(service.getNotifications());
    const req = ctrl.expectOne('/api/v1/notifications');
    expect(req.request.method).toBe('GET');
    req.flush({ events: [], count: 0, revision: '0:0:0' });
    await expect(pending).resolves.toEqual({ events: [], count: 0, revision: '0:0:0' });
  });

  it('should_get_the_summary', async () => {
    const pending = firstValueFrom(service.getSummary());
    const req = ctrl.expectOne('/api/v1/notifications/summary');
    expect(req.request.method).toBe('GET');
    req.flush({ count: 2, revision: '4:2:1' });
    await expect(pending).resolves.toEqual({ count: 2, revision: '4:2:1' });
  });

  it('should_post_a_dismissal', async () => {
    const pending = firstValueFrom(service.postDismiss(12));
    const req = ctrl.expectOne('/api/v1/notifications/12/dismiss');
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await pending;
  });

  it('should_post_dismiss_all', async () => {
    const pending = firstValueFrom(service.postDismissAll());
    const req = ctrl.expectOne('/api/v1/notifications/dismiss-all');
    expect(req.request.method).toBe('POST');
    req.flush({ dismissed: 3 });
    await expect(pending).resolves.toEqual({ dismissed: 3 });
  });
});
