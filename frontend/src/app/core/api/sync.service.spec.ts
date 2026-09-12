import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { apiBaseUrlInterceptor } from '../interceptors/api-base-url.interceptor';
import { SyncService } from './sync.service';

describe('SyncService', () => {
  let service: SyncService;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiBaseUrlInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(SyncService);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  it('should_post_sync_without_a_project_id', async () => {
    const pending = firstValueFrom(service.postSync());
    const req = ctrl.expectOne('/api/v1/sync');
    expect(req.request.method).toBe('POST');
    req.flush({ running: true }, { status: 202, statusText: 'Accepted' });

    await expect(pending).resolves.toEqual({ running: true });
  });

  it('should_post_sync_targeted_at_a_project', async () => {
    const pending = firstValueFrom(service.postSync(5));
    const req = ctrl.expectOne('/api/v1/sync?projectId=5');
    expect(req.request.method).toBe('POST');
    req.flush({ running: true }, { status: 202, statusText: 'Accepted' });

    await expect(pending).resolves.toEqual({ running: true });
  });

  it('should_get_sync_status', async () => {
    const status = { running: false, lastRun: null, nextRunAt: null };
    const pending = firstValueFrom(service.getStatus());
    const req = ctrl.expectOne('/api/v1/sync/status');
    expect(req.request.method).toBe('GET');
    req.flush(status);

    await expect(pending).resolves.toEqual(status);
  });
});
