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
    req.flush({ theme: 'system' });

    await expect(pending).resolves.toEqual(
      expect.objectContaining({ theme: 'system' }),
    );
  });

  it('should_put_settings', async () => {
    const body = { highlightMe: false };
    const pending = firstValueFrom(service.putSettings(body));
    const req = ctrl.expectOne('/api/v1/settings');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush({ highlightMe: false });

    await expect(pending).resolves.toEqual(
      expect.objectContaining({ highlightMe: false }),
    );
  });

  it('should_put_the_refresh_settings', async () => {
    const body = { refreshIntervalMin: 15, pauseWhenHidden: false };
    const pending = firstValueFrom(service.putSettings(body));
    const req = ctrl.expectOne('/api/v1/settings');
    expect(req.request.body).toEqual(body);
    req.flush({ refreshIntervalMin: 15, pauseWhenHidden: false });

    await expect(pending).resolves.toEqual(
      expect.objectContaining({ refreshIntervalMin: 15, pauseWhenHidden: false }),
    );
  });

  it('should_get_export_config', async () => {
    const pending = firstValueFrom(service.getExportConfig());
    const req = ctrl.expectOne('/api/v1/settings/export');
    expect(req.request.method).toBe('GET');
    req.flush({ version: 2, settings: {}, connections: [], projects: [] });

    await expect(pending).resolves.toEqual(expect.objectContaining({ version: 2 }));
  });

  it('should_post_import_config', async () => {
    const body = {
      version: 2 as const,
      settings: {},
      projects: [],
    };
    const pending = firstValueFrom(service.postImportConfig(body));
    const req = ctrl.expectOne('/api/v1/settings/import');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({
      settings: {},
      projectsAdded: 1,
      projectsUpdated: 0,
      projectsSkipped: [],
    });

    await expect(pending).resolves.toEqual(expect.objectContaining({ projectsAdded: 1 }));
  });
});
