import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { provideI18nTesting, t } from '../../../../core/i18n/testing';
import { apiBaseUrlInterceptor } from '../../../../core/interceptors/api-base-url.interceptor';
import { httpErrorInterceptor } from '../../../../core/interceptors/http-error.interceptor';
import { provideIcons } from '../../../../shared/icons/provide-icons';
import { SettingsForm, buildSettingsForm } from '../../settings-form';
import { MiscellaneousSectionComponent } from './miscellaneous-section.component';

@Component({
  imports: [MiscellaneousSectionComponent],
  template: `<app-miscellaneous-section [form]="form" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly form: SettingsForm = buildSettingsForm();
}

const FULL_SETTINGS = {
  gitlabUrl: 'https://gitlab.com',
  tokenConfigured: false,
  tokenHint: null,
  meUsername: null,
  meEmail: null,
  refreshIntervalMin: 5,
  pauseWhenHidden: true,
  easyFiles: 5,
  easyLines: 100,
  hardFiles: 20,
  hardLines: 800,
  readyGreenDays: 1,
  readyOrangeDays: 3,
  workdaysOnly: false,
  openInNewTab: false,
  ignoredLabels: [],
};

describe('MiscellaneousSectionComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let el: HTMLElement;
  let http: HttpTestingController;
  const snackBar = { open: vi.fn() };
  const dialog = { open: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideHttpClient(withInterceptors([apiBaseUrlInterceptor, httpErrorInterceptor])),
        provideHttpClientTesting(),
        provideI18nTesting(),
        provideIcons(),
        { provide: MatSnackBar, useValue: snackBar },
        { provide: MatDialog, useValue: dialog },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    vi.unstubAllGlobals();
  });

  const settle = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };
  const fileInput = () => el.querySelector<HTMLInputElement>('input[type="file"]')!;
  const selectFile = async (content: string) => {
    const file = new File([content], 'config.json', { type: 'application/json' });
    const files = Object.assign([file], { item: (i: number) => [file][i] ?? null }) as unknown as FileList;
    Object.defineProperty(fileInput(), 'files', { value: files, configurable: true });
    fileInput().dispatchEvent(new Event('change'));
    await settle();
  };

  it('should_render_the_four_checkboxes_and_disable_the_two_reserved_for_us_016', () => {
    const boxes = el.querySelectorAll('mat-checkbox');
    expect(boxes.length).toBe(4);
    expect(boxes[0].querySelector('input')?.disabled).toBe(true);
    expect(boxes[1].querySelector('input')?.disabled).toBe(true);
    expect(boxes[2].querySelector('input')?.disabled).toBe(false);
    expect(boxes[3].querySelector('input')?.disabled).toBe(false);
  });

  it('should_export_the_config_and_trigger_a_download', async () => {
    el.querySelectorAll<HTMLButtonElement>('button')[0].click();
    await settle();

    http
      .expectOne('/api/v1/settings/export')
      .flush({ version: 1, settings: { gitlabUrl: 'https://gitlab.com' }, projects: [] });
    await settle();

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });

  it('should_toast_a_generic_error_when_the_export_request_fails', async () => {
    el.querySelectorAll<HTMLButtonElement>('button')[0].click();
    await settle();

    http.expectOne('/api/v1/settings/export').flush('down', { status: 500, statusText: 'KO' });
    await settle();

    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(snackBar.open).toHaveBeenCalledWith(
      t('errors.unexpected'),
      t('common.ok'),
      expect.anything(),
    );
  });

  it('should_toast_an_invalid_file_without_opening_the_confirmation_dialog', async () => {
    await selectFile('not json');

    expect(dialog.open).not.toHaveBeenCalled();
    expect(snackBar.open).toHaveBeenCalledWith(
      t('settings.misc.importInvalid'),
      t('common.ok'),
      expect.anything(),
    );
  });

  it('should_open_the_confirmation_dialog_with_the_computed_summary', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of(false) });

    await selectFile(
      JSON.stringify({
        version: 1,
        settings: { gitlabUrl: 'https://gitlab.com', easyFiles: 10 },
        projects: [{ pathWithNamespace: 'equipe/backend-api', alias: 'api' }],
      }),
    );

    expect(dialog.open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          messageParams: { settingsCount: 2, totalRepos: 1, newRepos: 1 },
        }),
      }),
    );
    http.expectNone('/api/v1/settings/import');
  });

  it('should_import_reset_the_form_and_reload_projects_on_confirmation', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });

    await selectFile(
      JSON.stringify({
        version: 1,
        settings: { gitlabUrl: 'https://gitlab.com', easyFiles: 12 },
        projects: [],
      }),
    );

    const req = http.expectOne('/api/v1/settings/import');
    req.flush({
      settings: { ...FULL_SETTINGS, easyFiles: 12 },
      projectsAdded: 0,
      projectsUpdated: 0,
      projectsSkipped: [],
    });
    await settle();
    http.expectOne('/api/v1/projects').flush([]);
    await settle();

    expect(host.form.controls.easyFiles.value).toBe(12);
    expect(host.form.pristine).toBe(true);
    expect(snackBar.open).toHaveBeenCalledWith(
      t('settings.misc.importSuccess'),
      t('common.ok'),
      expect.anything(),
    );
  });

  it('should_toast_the_skipped_repos_after_a_partial_import', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });

    await selectFile(
      JSON.stringify({
        version: 1,
        settings: { gitlabUrl: 'https://gitlab.com' },
        projects: [{ pathWithNamespace: 'equipe/introuvable', alias: 'x' }],
      }),
    );

    const req = http.expectOne('/api/v1/settings/import');
    req.flush({
      settings: FULL_SETTINGS,
      projectsAdded: 0,
      projectsUpdated: 0,
      projectsSkipped: [{ pathWithNamespace: 'equipe/introuvable', reason: 'projects.notFound' }],
    });
    await settle();
    http.expectOne('/api/v1/projects').flush([]);
    await settle();

    expect(snackBar.open).toHaveBeenCalledWith(
      t('settings.misc.importSkipped', { paths: 'equipe/introuvable' }),
      t('common.ok'),
      expect.anything(),
    );
  });

  it('should_toast_a_generic_error_when_the_import_request_itself_fails', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });

    await selectFile(
      JSON.stringify({ version: 1, settings: { gitlabUrl: 'https://gitlab.com' }, projects: [] }),
    );

    http
      .expectOne('/api/v1/settings/import')
      .flush({ statusCode: 500 }, { status: 500, statusText: 'KO' });
    await settle();

    http.expectNone('/api/v1/projects');
    expect(snackBar.open).toHaveBeenCalledWith(
      t('errors.unexpected'),
      t('common.ok'),
      expect.anything(),
    );
  });

  it('should_not_call_the_import_endpoint_when_confirmation_is_declined', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of(false) });

    await selectFile(
      JSON.stringify({ version: 1, settings: { gitlabUrl: 'https://gitlab.com' }, projects: [] }),
    );

    http.expectNone('/api/v1/settings/import');
  });

  it('should_do_nothing_when_the_change_event_carries_no_file', async () => {
    const files = Object.assign([], { item: () => null }) as unknown as FileList;
    Object.defineProperty(fileInput(), 'files', { value: files, configurable: true });
    fileInput().dispatchEvent(new Event('change'));
    await settle();

    expect(dialog.open).not.toHaveBeenCalled();
    expect(snackBar.open).not.toHaveBeenCalled();
  });

  it('should_reset_the_file_input_value_after_selection', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of(false) });

    await selectFile(
      JSON.stringify({ version: 1, settings: { gitlabUrl: 'https://gitlab.com' }, projects: [] }),
    );

    expect(fileInput().value).toBe('');
  });
});
