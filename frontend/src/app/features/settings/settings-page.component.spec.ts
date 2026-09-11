import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, provideRouter } from '@angular/router';
import { provideI18nTesting, t } from '../../core/i18n/testing';
import { apiBaseUrlInterceptor } from '../../core/interceptors/api-base-url.interceptor';
import { httpErrorInterceptor } from '../../core/interceptors/http-error.interceptor';
import { Settings } from '../../models/settings.model';
import { provideIcons } from '../../shared/icons/provide-icons';
import { SettingsPageComponent } from './settings-page.component';

describe('SettingsPageComponent', () => {
  const settings: Settings = {
    gitlabUrl: 'https://gitlab.exemple.fr',
    tokenConfigured: false,
    tokenHint: null,
  };
  let fixture: ComponentFixture<SettingsPageComponent>;
  let el: HTMLElement;
  let http: HttpTestingController;
  let router: Router;
  const snackBar = { open: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [SettingsPageComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiBaseUrlInterceptor, httpErrorInterceptor])),
        provideHttpClientTesting(),
        provideI18nTesting(),
        provideIcons(),
        { provide: MatSnackBar, useValue: snackBar },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(SettingsPageComponent);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const settle = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };
  const urlInput = () => el.querySelector<HTMLInputElement>('input[formControlName="gitlabUrl"]')!;
  const tokenInput = () =>
    el.querySelector<HTMLInputElement>('input[formControlName="gitlabToken"]')!;
  const saveButton = () => el.querySelector<HTMLButtonElement>('button.save')!;
  const type = async (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  const loadSettings = async (value: Settings = settings) => {
    http.expectOne('/api/v1/settings').flush(value);
    await settle();
  };

  it('should_show_progress_then_form_with_loaded_url', async () => {
    expect(el.querySelector('mat-progress-bar')).not.toBeNull();

    await loadSettings();

    expect(el.querySelector('mat-progress-bar')).toBeNull();
    expect(urlInput().value).toBe('https://gitlab.exemple.fr');
    expect(tokenInput().value).toBe('');
    expect(saveButton().disabled).toBe(true);
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
  });

  it('should_show_error_and_retry_when_load_fails', async () => {
    http.expectOne('/api/v1/settings').flush('down', { status: 500, statusText: 'KO' });
    await settle();

    expect(el.querySelector('.load-error')?.textContent).toContain(t('settings.loadError'));
    expect(el.querySelector('button.save')).toBeNull();

    el.querySelector<HTMLButtonElement>('button.retry')!.click();
    await loadSettings();

    expect(urlInput().value).toBe('https://gitlab.exemple.fr');
  });

  it('should_enable_save_when_dirty_and_valid', async () => {
    await loadSettings();

    await type(urlInput(), 'https://autre.exemple.fr');
    expect(saveButton().disabled).toBe(false);
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);

    await type(urlInput(), 'pas-une-url');
    expect(saveButton().disabled).toBe(true);
  });

  it('should_save_then_toast_and_navigate_home', async () => {
    await loadSettings();
    await type(urlInput(), 'https://autre.exemple.fr/');
    await type(tokenInput(), 'glpat-abcdwxyz');

    saveButton().click();
    const req = http.expectOne('/api/v1/settings');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      gitlabUrl: 'https://autre.exemple.fr/',
      gitlabToken: 'glpat-abcdwxyz',
    });
    req.flush({ gitlabUrl: 'https://autre.exemple.fr', tokenConfigured: true, tokenHint: 'wxyz' });
    await settle();

    expect(snackBar.open).toHaveBeenCalledWith(
      t('settings.saved'),
      t('common.ok'),
      expect.objectContaining({ panelClass: 'mrb-toast' }),
    );
    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
    expect(tokenInput().value).toBe('');
  });

  it('should_toast_error_and_stay_when_save_fails', async () => {
    await loadSettings();
    await type(urlInput(), 'https://autre.exemple.fr');

    saveButton().click();
    http.expectOne('/api/v1/settings').flush({ statusCode: 500 }, { status: 500, statusText: 'KO' });
    await settle();

    expect(snackBar.open).toHaveBeenCalledWith(t('settings.saveError'), t('common.ok'), expect.anything());
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(urlInput().value).toBe('https://autre.exemple.fr');
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);
  });

  it('should_navigate_home_on_cancel', async () => {
    await loadSettings();

    el.querySelector<HTMLButtonElement>('button.cancel')!.click();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('should_disable_test_without_token_and_enable_with_stored_token', async () => {
    await loadSettings();
    const testButton = () => el.querySelector<HTMLButtonElement>('.test-button')!;
    expect(testButton().disabled).toBe(true);

    await type(tokenInput(), 'glpat-abcdwxyz');
    expect(testButton().disabled).toBe(false);

    await type(tokenInput(), '');
    expect(testButton().disabled).toBe(true);
  });

  it('should_test_with_stored_token_and_reset_result_on_change', async () => {
    await loadSettings({ ...settings, tokenConfigured: true, tokenHint: 'wxyz' });
    const testButton = () => el.querySelector<HTMLButtonElement>('.test-button')!;
    expect(testButton().disabled).toBe(false);

    testButton().click();
    await settle();
    expect(testButton().disabled).toBe(true);
    const req = http.expectOne('/api/v1/settings/test-connection');
    expect(req.request.body).toEqual({ gitlabUrl: 'https://gitlab.exemple.fr' });
    req.flush({
      username: 'mdupont',
      name: 'Marie Dupont',
      avatarUrl: null,
      expiresAt: null,
      expirationKnown: true,
    });
    await settle();
    expect(el.querySelector('.test-result')?.classList.contains('success')).toBe(true);

    await type(urlInput(), 'https://gitlab.exemple.fr/x');
    expect(el.querySelector('.test-result')).toBeNull();
  });

  it('should_show_test_error_from_backend_code', async () => {
    await loadSettings();
    await type(tokenInput(), 'glpat-abcdwxyz');

    el.querySelector<HTMLButtonElement>('.test-button')!.click();
    http
      .expectOne('/api/v1/settings/test-connection')
      .flush({ statusCode: 502, code: 'gitlab.auth', message: 'x' }, { status: 502, statusText: 'Bad Gateway' });
    await settle();

    expect(el.querySelector('.test-result')?.textContent?.trim()).toBe(t('errors.gitlab.auth'));
  });
});
