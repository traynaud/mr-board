import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { apiBaseUrlInterceptor } from '../interceptors/api-base-url.interceptor';
import { EMPTY_HISTORY_FILTERS } from '../../models/history.model';
import { HistoryService, historyFilterParams } from './history.service';

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

  it('should_send_the_filters_as_query_params', async () => {
    const pending = firstValueFrom(
      service.getHistory('abc', undefined, {
        search: ' refacto ',
        types: ['merged', 'closed'],
        actors: ['alice', 'none'],
        projects: [1, 2],
        from: null,
        to: null,
      }),
    );
    const req = ctrl.expectOne((r) => r.url === '/api/v1/history');
    expect(req.request.params.get('q')).toBe('refacto');
    expect(req.request.params.get('type')).toBe('merged,closed');
    expect(req.request.params.get('actor')).toBe('alice,none');
    expect(req.request.params.get('project')).toBe('1,2');
    expect(req.request.params.get('cursor')).toBe('abc');
    req.flush({ events: [], nextCursor: null, total: 0 });
    await pending;
  });

  it('should_get_the_actor_options', async () => {
    const pending = firstValueFrom(service.getActors());
    const req = ctrl.expectOne('/api/v1/history/actors');
    expect(req.request.method).toBe('GET');
    req.flush([{ username: 'alice', name: 'Alice', avatarUrl: null }]);
    await expect(pending).resolves.toHaveLength(1);
  });

  describe('historyFilterParams', () => {
    it('should_send_nothing_without_filters', () => {
      expect(historyFilterParams(EMPTY_HISTORY_FILTERS)).toEqual({});
    });

    it('should_convert_local_days_to_an_inclusive_start_and_an_exclusive_end', () => {
      const params = historyFilterParams({
        ...EMPTY_HISTORY_FILTERS,
        from: '2026-11-06',
        to: '2026-11-08',
      });
      expect(params['from']).toBe(new Date(2026, 10, 6).toISOString());
      // « Au 08/11 inclus » = avant le début du 09/11 local.
      expect(params['to']).toBe(new Date(2026, 10, 9).toISOString());
    });

    it('should_handle_a_single_bound_and_month_ends', () => {
      expect(historyFilterParams({ ...EMPTY_HISTORY_FILTERS, to: '2026-11-30' })).toEqual({
        to: new Date(2026, 11, 1).toISOString(),
      });
      expect(historyFilterParams({ ...EMPTY_HISTORY_FILTERS, from: '2026-11-06' })).toEqual({
        from: new Date(2026, 10, 6).toISOString(),
      });
    });
  });
});
