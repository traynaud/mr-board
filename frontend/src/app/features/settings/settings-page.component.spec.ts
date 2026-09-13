import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, provideRouter } from '@angular/router';
import { provideI18nTesting, t } from '../../core/i18n/testing';
import { apiBaseUrlInterceptor } from '../../core/interceptors/api-base-url.interceptor';
import { httpErrorInterceptor } from '../../core/interceptors/http-error.interceptor';
import { LanguageService } from '../../core/language/language.service';
import { stubMatchMedia } from '../../core/theme/testing';
import { ThemeService } from '../../core/theme/theme.service';
import { Connection } from '../../models/connection.model';
import { Project } from '../../models/project.model';
import { Settings } from '../../models/settings.model';
import { provideIcons } from '../../shared/icons/provide-icons';
import { ColumnsStore } from '../../stores/columns.store';
import { FiltersStore } from '../../stores/filters.store';
import { SettingsPageComponent } from './settings-page.component';

describe('SettingsPageComponent', () => {
  const settings: Settings = {
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
    notifyAssigned: false,
    tabBadge: false,
    theme: 'system',
    highlightMe: true,
    language: 'fr',
  };
  const connection: Connection = {
    id: 1,
    type: 'gitlab',
    name: 'GitLab',
    url: 'https://gitlab.exemple.fr',
    tokenConfigured: true,
    tokenHint: 'wxyz',
    meUsername: null,
    projectsCount: 0,
  };
  const projectApi: Project = {
    id: 1,
    connectionId: 1,
    pathWithNamespace: 'equipe/backend-api',
    alias: 'api',
    remoteProjectId: '42',
  };
  const projectWeb: Project = {
    id: 2,
    connectionId: 1,
    pathWithNamespace: 'equipe/front-web',
    alias: 'web',
    remoteProjectId: '7',
  };
  let fixture: ComponentFixture<SettingsPageComponent>;
  let el: HTMLElement;
  let http: HttpTestingController;
  let router: Router;
  const snackBar = { open: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    stubMatchMedia(false);
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
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(SettingsPageComponent);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    vi.unstubAllGlobals();
    localStorage.clear();
    http.verify();
  });

  const settle = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };
  /** Flushe le déclenchement de synchro fire-and-forget après un save réussi (RG-004-15). */
  const flushSync = async () => {
    http.expectOne('/api/v1/sync').flush({ running: true }, { status: 202, statusText: 'Accepted' });
    await settle();
    http.expectOne('/api/v1/sync/status').flush({ running: true, lastRun: null, nextRunAt: null });
    await settle();
  };
  const emailInput = () => el.querySelector<HTMLInputElement>('input[formControlName="meEmail"]')!;
  const usernameInputs = () =>
    el.querySelectorAll<HTMLInputElement>('input[formControlName="username"]');
  const repoAliasInputs = () =>
    el.querySelectorAll<HTMLInputElement>('.repos-table tbody tr:not(.add-row) input[formControlName="alias"]');
  const saveButton = () => el.querySelector<HTMLButtonElement>('button.save')!;
  const resetButton = () => el.querySelector<HTMLButtonElement>('button.reset')!;
  const type = async (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  const loadSettings = async (
    value: Settings = settings,
    connections: Connection[] = [connection],
    projects: Project[] = [],
  ) => {
    http.expectOne('/api/v1/settings').flush(value);
    await settle();
    http.expectOne('/api/v1/connections').flush(connections);
    await settle();
    http.expectOne('/api/v1/projects').flush(projects);
    await settle();
  };

  const FULL_UPDATE_REQUEST = {
    identities: [{ connectionId: 1, username: '' }],
    meEmail: '',
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
    notifyAssigned: false,
    tabBadge: false,
    theme: 'system',
    highlightMe: true,
    language: 'fr',
  };

  it('should_show_progress_then_form_once_loaded', async () => {
    expect(el.querySelector('mat-progress-bar')).not.toBeNull();

    await loadSettings();

    expect(el.querySelector('mat-progress-bar')).toBeNull();
    expect(emailInput().value).toBe('');
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

    expect(emailInput().value).toBe('');
  });

  it('should_enable_save_when_dirty_and_valid', async () => {
    await loadSettings();

    await type(emailInput(), 'marie@exemple.fr');
    expect(saveButton().disabled).toBe(false);
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);

    await type(emailInput(), 'pas-un-email');
    expect(saveButton().disabled).toBe(true);
  });

  it('should_save_then_toast_and_navigate_home', async () => {
    await loadSettings();

    saveButton().click();
    // Rien n'est modifié : le bouton est désactivé, donc `save()` ne doit
    // rien envoyer — on force plutôt une modification avant de sauvegarder.
    await type(emailInput(), 'marie@exemple.fr');

    saveButton().click();
    const req = http.expectOne('/api/v1/settings');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ ...FULL_UPDATE_REQUEST, meEmail: 'marie@exemple.fr' });
    req.flush({ ...settings, meEmail: 'marie@exemple.fr' });
    await settle();
    await flushSync();

    expect(snackBar.open).toHaveBeenCalledWith(
      t('settings.saved'),
      t('common.ok'),
      expect.objectContaining({ panelClass: 'mrb-toast' }),
    );
    expect(router.navigate).toHaveBeenCalledWith(['/'], {
      queryParams: { drafts: '0', mine: '0', sort: 'ready:asc' },
    });
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
  });

  it('should_save_with_trimmed_identity_fields', async () => {
    await loadSettings();
    await type(usernameInputs()[0], '  mdupont  ');
    await type(emailInput(), 'marie@exemple.fr');

    saveButton().click();
    const req = http.expectOne('/api/v1/settings');
    expect(req.request.body).toEqual({
      ...FULL_UPDATE_REQUEST,
      meEmail: 'marie@exemple.fr',
      identities: [{ connectionId: 1, username: 'mdupont' }],
    });
  });

  it('should_toast_error_and_stay_when_save_fails', async () => {
    await loadSettings();
    await type(emailInput(), 'marie@exemple.fr');

    saveButton().click();
    http.expectOne('/api/v1/settings').flush({ statusCode: 500 }, { status: 500, statusText: 'KO' });
    await settle();

    expect(snackBar.open).toHaveBeenCalledWith(t('settings.saveError'), t('common.ok'), expect.anything());
    expect(router.navigate).not.toHaveBeenCalled();
    expect(emailInput().value).toBe('marie@exemple.fr');
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);
  });

  it('should_reset_the_whole_form_to_defaults_without_touching_the_repos', async () => {
    await loadSettings({ ...settings, easyFiles: 12, openInNewTab: true }, [connection], [projectApi]);

    resetButton().click();
    await settle();

    expect(emailInput().value).toBe('');
    expect(repoAliasInputs()).toHaveLength(1);
    expect(repoAliasInputs()[0].value).toBe('api');
    expect(saveButton().disabled).toBe(false);
    expect(snackBar.open).toHaveBeenCalledWith(
      t('settings.reset.done'),
      t('common.ok'),
      expect.anything(),
    );
  });

  it('should_navigate_home_on_cancel', async () => {
    await loadSettings();

    el.querySelector<HTMLButtonElement>('button.cancel')!.click();

    expect(router.navigate).toHaveBeenCalledWith(['/'], {
      queryParams: { drafts: '0', mine: '0', sort: 'ready:asc' },
    });
  });

  it('should_navigate_to_the_board_with_its_current_filters_on_cancel', async () => {
    TestBed.inject(FiltersStore).toggleMine();
    TestBed.inject(ColumnsStore).toggleOpened();
    await loadSettings();

    el.querySelector<HTMLButtonElement>('button.cancel')!.click();

    expect(router.navigate).toHaveBeenCalledWith(['/'], {
      // RG-017-09 : « Statut » reste visible (défaut), donc `cols` liste les deux colonnes.
      queryParams: { drafts: '0', mine: '1', sort: 'ready:asc', cols: 'status,opened' },
    });
  });

  it('should_bind_the_current_board_query_params_to_the_back_link', async () => {
    TestBed.inject(FiltersStore).toggleMine();
    await loadSettings();

    const backLink = el.querySelector<HTMLAnchorElement>('a[routerLink="/"]');
    expect(backLink?.getAttribute('href')).toContain('mine=1');
  });

  it('should_render_one_identity_row_per_connection', async () => {
    await loadSettings(settings, [
      connection,
      { ...connection, id: 2, name: 'gitlab.exemple.fr' },
    ]);

    expect(usernameInputs()).toHaveLength(2);
  });

  it('should_show_the_no_connection_message_when_there_is_no_connection', async () => {
    await loadSettings(settings, []);

    expect(el.querySelector('.no-connection')).not.toBeNull();
    expect(usernameInputs()).toHaveLength(0);
  });

  it('should_show_manual_status_for_a_typed_username_without_a_matching_test', async () => {
    await loadSettings();
    await type(usernameInputs()[0], 'lrousseau');

    expect(el.querySelector('.identity-status')?.textContent?.trim()).toBe(
      t('settings.me.status.manual'),
    );

    await type(usernameInputs()[0], '');
    expect(el.querySelector('.identity-preview')).toBeNull();
  });

  it('should_render_repo_rows_from_the_projects_store', async () => {
    await loadSettings(settings, [connection], [projectApi, projectWeb]);

    expect(el.textContent).toContain('equipe/backend-api');
    expect(el.textContent).toContain('equipe/front-web');
    expect(repoAliasInputs()).toHaveLength(2);
    expect(repoAliasInputs()[0].value).toBe('api');
    expect(repoAliasInputs()[1].value).toBe('web');
  });

  it('should_activate_save_when_an_alias_is_edited_and_include_it_on_save', async () => {
    await loadSettings(settings, [connection], [projectApi]);
    expect(saveButton().disabled).toBe(true);

    await type(repoAliasInputs()[0], 'back');
    expect(saveButton().disabled).toBe(false);
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);

    saveButton().click();
    const settingsReq = http.expectOne('/api/v1/settings');
    settingsReq.flush(settings);
    await settle();
    await flushSync();

    const renameReq = http.expectOne('/api/v1/projects/1');
    expect(renameReq.request.method).toBe('PUT');
    expect(renameReq.request.body).toEqual({ alias: 'back' });
    renameReq.flush({ ...projectApi, alias: 'back' });
    await settle();

    expect(snackBar.open).toHaveBeenCalledWith(
      t('settings.saved'),
      t('common.ok'),
      expect.anything(),
    );
    expect(router.navigate).toHaveBeenCalledWith(['/'], {
      queryParams: { drafts: '0', mine: '0', sort: 'ready:asc' },
    });
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
    expect(repoAliasInputs()[0].value).toBe('back');
  });

  it('should_not_send_a_rename_request_when_no_alias_was_touched', async () => {
    await loadSettings(settings, [connection], [projectApi]);
    await type(emailInput(), 'marie@exemple.fr');

    saveButton().click();
    http.expectOne('/api/v1/settings').flush({ ...settings, meEmail: 'marie@exemple.fr' });
    await settle();
    await flushSync();

    http.expectNone('/api/v1/projects/1');
  });

  it('should_keep_form_dirty_and_not_navigate_when_a_rename_fails', async () => {
    await loadSettings(settings, [connection], [projectApi, projectWeb]);
    await type(repoAliasInputs()[1], 'API');

    saveButton().click();
    http.expectOne('/api/v1/settings').flush(settings);
    await settle();
    await flushSync();

    http
      .expectOne('/api/v1/projects/2')
      .flush(
        { statusCode: 400, code: 'projects.aliasDuplicate', message: 'x' },
        { status: 400, statusText: 'Bad Request' },
      );
    await settle();

    expect(snackBar.open).toHaveBeenCalledWith(t('settings.saveError'), t('common.ok'), expect.anything());
    expect(router.navigate).not.toHaveBeenCalled();
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);
    expect(repoAliasInputs()[1].value).toBe('API');
  });

  it('should_discard_unsaved_alias_edit_when_another_repo_is_added_immediately', async () => {
    await loadSettings(settings, [connection], [projectApi]);
    await type(repoAliasInputs()[0], 'back');
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);

    const pathInput = el.querySelector<HTMLInputElement>(
      '.add-fields input[formControlName="path"]',
    )!;
    pathInput.value = 'equipe/front-web';
    pathInput.dispatchEvent(new Event('input'));
    await settle();
    el.querySelector<HTMLButtonElement>('.add-fields button')!.click();
    await settle();
    http.expectOne('/api/v1/projects').flush(projectWeb);
    await settle();
    http
      .expectOne(`/api/v1/sync?projectId=${projectWeb.id}`)
      .flush({ running: true }, { status: 202, statusText: 'Accepted' });
    await settle();
    http.expectOne('/api/v1/sync/status').flush({ running: true, lastRun: null, nextRunAt: null });
    await settle();

    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
    expect(repoAliasInputs()).toHaveLength(2);
    expect(repoAliasInputs()[0].value).toBe('api');
  });

  it('should_preview_the_theme_immediately_and_restore_it_when_the_page_is_left', async () => {
    await loadSettings();
    const themeService = TestBed.inject(ThemeService);
    TestBed.flushEffects();

    const darkRadio = Array.from(
      el.querySelectorAll<HTMLElement>('app-miscellaneous-section mat-radio-button'),
    )[2].querySelector<HTMLInputElement>('input')!;
    darkRadio.click();
    await settle();

    expect(themeService.preference()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);

    fixture.destroy();
    TestBed.flushEffects();

    expect(themeService.preference()).toBe('system');
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('should_preview_the_language_immediately_and_restore_it_when_the_page_is_left', async () => {
    await loadSettings();
    const languageService = TestBed.inject(LanguageService);
    TestBed.flushEffects();

    const englishRadio = Array.from(
      el.querySelectorAll<HTMLElement>('app-miscellaneous-section mat-radio-button'),
    )[4].querySelector<HTMLInputElement>('input')!;
    englishRadio.click();
    await settle();
    http.expectOne('i18n/en.json').flush({});

    expect(languageService.preference()).toBe('en');
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);

    fixture.destroy();
    TestBed.flushEffects();

    expect(languageService.preference()).toBe('fr');
  });
});
