import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { apiBaseUrlInterceptor } from '../interceptors/api-base-url.interceptor';
import { HistoryService } from './history.service';

describe('HistoryService', () => {
  let service: HistoryService;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiBaseUrlInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(HistoryService);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  it('should_get_first_page_without_params', async () => {
    const pending = firstValueFrom(service.getHistory(null));
    const req = ctrl.expectOne('/api/v1/history');
    expect(req.request.method).toBe('GET');
    req.flush({ events: [], nextCursor: null, total: 0 });
    await expect(pending).resolves.toEqual({ events: [], nextCursor: null, total: 0 });
  });

  it('should_send_cursor_and_limit', async () => {
    const pending = firstValueFrom(service.getHistory('abc', 20));
    const req = ctrl.expectOne((r) => r.url === '/api/v1/history');
    expect(req.request.params.get('cursor')).toBe('abc');
    expect(req.request.params.get('limit')).toBe('20');
    req.flush({ events: [], nextCursor: null, total: 0 });
    await pending;
  });
});
