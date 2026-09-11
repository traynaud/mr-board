import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../api/api-error';
import { apiBaseUrlInterceptor } from './api-base-url.interceptor';
import { httpErrorInterceptor } from './http-error.interceptor';

describe('HTTP interceptors', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiBaseUrlInterceptor, httpErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  it('should_prefix_api_scheme_with_base_url', async () => {
    const pending = firstValueFrom(http.get('api://health'));
    ctrl.expectOne('/api/v1/health').flush({ status: 'ok' });

    await expect(pending).resolves.toEqual({ status: 'ok' });
  });

  it('should_leave_other_urls_untouched', async () => {
    const pending = firstValueFrom(http.get('i18n/fr.json'));
    ctrl.expectOne('i18n/fr.json').flush({});

    await expect(pending).resolves.toEqual({});
  });

  it('should_map_backend_error_to_api_error', async () => {
    const pending = firstValueFrom(http.get('api://projects/9'));
    ctrl.expectOne('/api/v1/projects/9').flush(
      { statusCode: 404, code: 'entity.notFound', message: 'Project 9 not found' },
      { status: 404, statusText: 'Not Found' },
    );

    const error = await pending.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(404);
    expect(apiError.code).toBe('entity.notFound');
    expect(apiError.message).toBe('Project 9 not found');
    expect(apiError.i18nKey).toBe('errors.entity.notFound');
  });

  it('should_join_validation_messages', async () => {
    const pending = firstValueFrom(http.get('api://x'));
    ctrl.expectOne('/api/v1/x').flush(
      { statusCode: 400, message: ['a is required', 'b is required'] },
      { status: 400, statusText: 'Bad Request' },
    );

    const error = (await pending.catch((e: unknown) => e)) as ApiError;
    expect(error.message).toBe('a is required, b is required');
    expect(error.i18nKey).toBe('errors.unexpected');
  });

  it('should_map_network_failure_to_status_0', async () => {
    const pending = firstValueFrom(http.get('api://x'));
    ctrl.expectOne('/api/v1/x').error(new ProgressEvent('error'));

    const error = (await pending.catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(0);
    expect(error.i18nKey).toBe('errors.network');
  });
});
