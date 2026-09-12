import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { apiBaseUrlInterceptor } from '../interceptors/api-base-url.interceptor';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiBaseUrlInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(SettingsService);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  it('should_get_settings', async () => {
    const pending = firstValueFrom(service.getSettings());
    const req = ctrl.expectOne('/api/v1/settings');
    expect(req.request.method).toBe('GET');
    req.flush({ gitlabUrl: 'https://gitlab.com', tokenConfigured: false, tokenHint: null });

    await expect(pending).resolves.toEqual(
      expect.objectContaining({ gitlabUrl: 'https://gitlab.com' }),
    );
  });

  it('should_put_settings', async () => {
    const body = { gitlabUrl: 'https://gitlab.exemple.fr', gitlabToken: 'glpat-abcdwxyz' };
    const pending = firstValueFrom(service.putSettings(body));
    const req = ctrl.expectOne('/api/v1/settings');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush({ gitlabUrl: body.gitlabUrl, tokenConfigured: true, tokenHint: 'wxyz' });

    await expect(pending).resolves.toEqual(expect.objectContaining({ tokenHint: 'wxyz' }));
  });

  it('should_put_the_refresh_settings', async () => {
    const body = {
      gitlabUrl: 'https://gitlab.com',
      refreshIntervalMin: 15,
      pauseWhenHidden: false,
    };
    const pending = firstValueFrom(service.putSettings(body));
    const req = ctrl.expectOne('/api/v1/settings');
    expect(req.request.body).toEqual(body);
    req.flush({
      gitlabUrl: body.gitlabUrl,
      tokenConfigured: false,
      tokenHint: null,
      refreshIntervalMin: 15,
      pauseWhenHidden: false,
    });

    await expect(pending).resolves.toEqual(
      expect.objectContaining({ refreshIntervalMin: 15, pauseWhenHidden: false }),
    );
  });

  it('should_post_test_connection', async () => {
    const pending = firstValueFrom(service.postTestConnection({ gitlabUrl: 'https://gitlab.com' }));
    const req = ctrl.expectOne('/api/v1/settings/test-connection');
    expect(req.request.method).toBe('POST');
    req.flush({ username: 'mdupont' });

    await expect(pending).resolves.toEqual(expect.objectContaining({ username: 'mdupont' }));
  });
});
