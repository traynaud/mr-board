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
    historyRetentionDays: 60,
    historyMaxEvents: 5000,
    notifDisabledTypes: [],
    notifOnlyMine: false,
    notifExcludeOwn: false,
  };
  const connection: Connection = {
    id: 1,
    type: 'gitlab',
    name: 'GitLab',
    url: 'https://gitlab.exemple.fr',
    tokenConfigured: true,
    tokenHint: 'wxyz',
    identity: null,
    projectsCount: 0,
  };
  const projectApi: Project = {
    id: 1,
    connectionId: 1,
    pathWithNamespace: 'equipe/backend-api',
    alias: 'api',
    remoteProjectId: '42',
    color: null,
  };
  const projectWeb: Project = {
    id: 2,
    connectionId: 1,
    pathWithNamespace: 'equipe/front-web',
    alias: 'web',
    remoteProjectId: '7',
    color: null,
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
  const easyFilesInput = () => el.querySelector<HTMLInputElement>('input[formControlName="easyFiles"]')!;
  const repoAliasInputs = () =>
    el.querySelectorAll<HTMLInputElement>('.repos-table tbody tr:not(.add-row) input[formControlName="alias"]');
  const saveButton = () => el.querySelector<HTMLButtonElement>('button.save')!;
  const resetButton = () => el.querySelector<HTMLButtonElement>('button.reset')!;
  const type = async (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  /** US-021 §0 : les repos vivent désormais dans la carte dépliée de leur connexion. */
  const expandConnection = async (name: string) => {
    const summary = Array.from(el.querySelectorAll<HTMLElement>('.connection-summary')).find((row) =>
      row.textContent?.includes(name),
    )!;
    summary.click();
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
    historyRetentionDays: 60,
    historyMaxEvents: 5000,
    notifDisabledTypes: [],
    notifOnlyMine: false,
    notifExcludeOwn: false,
  };

  it('should_show_progress_then_form_once_loaded', async () => {
    expect(el.querySelector('mat-progress-bar')).not.toBeNull();

    await loadSettings();

    expect(el.querySelector('mat-progress-bar')).toBeNull();
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

    expect(saveButton().disabled).toBe(true);
  });

  it('should_enable_save_when_dirty_and_valid', async () => {
    await loadSettings();

    await type(easyFilesInput(), '10');
    expect(saveButton().disabled).toBe(false);
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);

    await type(easyFilesInput(), '25');
    expect(saveButton().disabled).toBe(true);
  });

  it('should_save_then_toast_and_navigate_home', async () => {
    await loadSettings();

    saveButton().click();
    // Rien n'est modifié : le bouton est désactivé, donc `save()` ne doit
    // rien envoyer — on force plutôt une modification avant de sauvegarder.
    await type(easyFilesInput(), '10');

    saveButton().click();
    const req = http.expectOne('/api/v1/settings');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ ...FULL_UPDATE_REQUEST, easyFiles: 10 });
    req.flush({ ...settings, easyFiles: 10 });
    await settle();
    await flushSync();

    expect(snackBar.open).toHaveBeenCalledWith(
      t('settings.saved'),
      t('common.ok'),
      expect.objectContaining({ panelClass: 'mrb-toast' }),
    );
    expect(router.navigate).toHaveBeenCalledWith(['/'], {
      queryParams: { drafts: '0', mine: '0', fav: '0', toReview: '0', sort: 'ready:asc' },
    });
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
  });

  it('should_toast_error_and_stay_when_save_fails', async () => {
    await loadSettings();
    await type(easyFilesInput(), '10');

    saveButton().click();
    http.expectOne('/api/v1/settings').flush({ statusCode: 500 }, { status: 500, statusText: 'KO' });
    await settle();

    expect(snackBar.open).toHaveBeenCalledWith(t('settings.saveError'), t('common.ok'), expect.anything());
    expect(router.navigate).not.toHaveBeenCalled();
    expect(easyFilesInput().value).toBe('10');
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);
  });

  it('should_reset_the_whole_form_to_defaults_without_touching_the_repos', async () => {
    await loadSettings({ ...settings, easyFiles: 12, openInNewTab: true }, [connection], [projectApi]);
    await expandConnection('GitLab');

    resetButton().click();
    await settle();

    expect(easyFilesInput().value).toBe('5');
    expect(repoAliasInputs()).toHaveLength(1);
    expect(repoAliasInputs()[0].value).toBe('api');
    expect(saveButton().disabled).toBe(false);
    expect(snackBar.open).toHaveBeenCalledWith(
      t('settings.reset.done'),
      t('common.ok'),
      expect.anything(),
    );
  });

  describe('onglets (US-042)', () => {
    const headingsOf = (panelIndex: number) =>
      Array.from(el.querySelectorAll('.settings-grid')[panelIndex].querySelectorAll('.heading h6')).map((h) =>
        h.textContent?.trim(),
      );
    const panels = () => Array.from(el.querySelectorAll<HTMLElement>('.settings-grid'));
    const visibleIndexes = () =>
      panels()
        .map((panel, index) => (panel.hidden ? -1 : index))
        .filter((index) => index >= 0);
    const openTab = async (tab: string | null) => {
      await router.navigateByUrl(tab === null ? '/' : `/?tab=${tab}`);
      await settle();
    };

    it('should_group_the_sections_in_four_tabs_and_renumber_each_tab_from_01_rg_042_01', async () => {
      await loadSettings();

      expect(headingsOf(0)).toEqual([`01 · ${t('settings.connections.title')}`]);
      expect(headingsOf(1)).toEqual([
        `01 · ${t('settings.refresh.title')}`,
        `02 · ${t('settings.history.title')}`,
        `03 · ${t('settings.data.transfer.title')}`,
      ]);
      expect(headingsOf(2)).toEqual([
        `01 · ${t('settings.difficulty.title')}`,
        `02 · ${t('settings.readyDelay.title')}`,
        `03 · ${t('settings.misc.title')}`,
      ]);
      expect(headingsOf(3)).toEqual([
        `01 · ${t('settings.notifications.scope.title')}`,
        `02 · ${t('settings.notifications.types.title')}`,
        `03 · ${t('settings.notifications.alerts.title')}`,
      ]);
    });

    it('should_open_the_first_tab_by_default_and_when_the_tab_is_unknown_rg_042_03', async () => {
      await loadSettings();
      expect(visibleIndexes()).toEqual([0]);

      await openTab('xyz');

      expect(visibleIndexes()).toEqual([0]);
    });

    it.each([
      ['data', 1],
      ['display', 2],
      ['notifications', 3],
    ])('should_open_the_%s_tab_from_the_url_rg_042_03', async (tab, index) => {
      await loadSettings();

      await openTab(tab);

      expect(visibleIndexes()).toEqual([index]);
    });

    it('should_keep_every_tab_mounted_so_no_edit_is_lost_when_switching_rg_042_02', async () => {
      await loadSettings();

      await type(easyFilesInput(), '4');
      await openTab('notifications');
      await openTab('display');

      expect(easyFilesInput().value).toBe('4');
      expect(saveButton().disabled).toBe(false);
    });

    it('should_flag_an_inactive_tab_holding_an_unsaved_edit_or_a_validation_error_rg_042_03', async () => {
      await loadSettings();
      const mark = (tab: string) => el.querySelector(`.tab-${tab} .tab-mark`);
      expect(mark('display')).toBeNull();

      await openTab('notifications');
      await type(easyFilesInput(), '4');
      expect(mark('display')).not.toBeNull();
      expect(mark('display')?.classList.contains('error')).toBe(false);

      await type(easyFilesInput(), '0');
      expect(mark('display')?.classList.contains('error')).toBe(true);
    });

    it('should_save_the_edits_of_two_tabs_with_a_single_request_rg_042_02', async () => {
      await loadSettings();
      await type(easyFilesInput(), '4');
      await openTab('notifications');
      const section = fixture.debugElement.nativeElement.querySelector('app-notification-types-section');
      section.querySelector('mat-checkbox input').click();
      await settle();

      saveButton().click();
      await settle();

      const request = http.expectOne((r) => r.method === 'PUT' && r.url === '/api/v1/settings');
      expect(request.request.body.easyFiles).toBe(4);
      expect(request.request.body.notifDisabledTypes).toEqual(['created']);
      request.flush({ ...settings, easyFiles: 4, notifDisabledTypes: ['created'] });
      await settle();
      await flushSync();
    });
  });

  it('should_render_the_history_retention_section_with_the_loaded_values_us_036', async () => {
    await loadSettings();

    expect(el.querySelector('app-history-section')).not.toBeNull();
    expect(
      el.querySelector<HTMLInputElement>('input[formControlName="historyMaxEvents"]')!.value,
    ).toBe('5000');
  });

  it('should_navigate_home_on_cancel', async () => {
    await loadSettings();

    el.querySelector<HTMLButtonElement>('button.cancel')!.click();

    expect(router.navigate).toHaveBeenCalledWith(['/'], {
      queryParams: { drafts: '0', mine: '0', fav: '0', toReview: '0', sort: 'ready:asc' },
    });
  });

  it('should_navigate_to_the_board_with_its_current_filters_on_cancel', async () => {
    TestBed.inject(FiltersStore).toggleMine();
    TestBed.inject(ColumnsStore).toggleOpened();
    await loadSettings();

    el.querySelector<HTMLButtonElement>('button.cancel')!.click();

    expect(router.navigate).toHaveBeenCalledWith(['/'], {
      // RG-017-09 : « Statut » reste visible (défaut), donc `cols` liste les deux colonnes.
      queryParams: { drafts: '0', mine: '1', fav: '0', toReview: '0', sort: 'ready:asc', cols: 'status,opened' },
    });
  });

  it('should_bind_the_current_board_query_params_to_the_back_link', async () => {
    TestBed.inject(FiltersStore).toggleMine();
    await loadSettings();

    const backLink = el.querySelector<HTMLAnchorElement>('a[routerLink="/"]');
    expect(backLink?.getAttribute('href')).toContain('mine=1');
  });

  it('should_render_repo_rows_from_the_projects_store', async () => {
    await loadSettings(settings, [connection], [projectApi, projectWeb]);
    await expandConnection('GitLab');

    expect(el.textContent).toContain('equipe/backend-api');
    expect(el.textContent).toContain('equipe/front-web');
    expect(repoAliasInputs()).toHaveLength(2);
    expect(repoAliasInputs()[0].value).toBe('api');
    expect(repoAliasInputs()[1].value).toBe('web');
  });

  it('should_activate_save_when_an_alias_is_edited_and_include_it_on_save', async () => {
    await loadSettings(settings, [connection], [projectApi]);
    await expandConnection('GitLab');
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
    expect(renameReq.request.body).toEqual({ alias: 'back', color: null });
    renameReq.flush({ ...projectApi, alias: 'back' });
    await settle();

    expect(snackBar.open).toHaveBeenCalledWith(
      t('settings.saved'),
      t('common.ok'),
      expect.anything(),
    );
    expect(router.navigate).toHaveBeenCalledWith(['/'], {
      queryParams: { drafts: '0', mine: '0', fav: '0', toReview: '0', sort: 'ready:asc' },
    });
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
    expect(repoAliasInputs()[0].value).toBe('back');
  });

  it('should_not_send_a_rename_request_when_no_alias_was_touched', async () => {
    await loadSettings(settings, [connection], [projectApi]);
    await type(easyFilesInput(), '10');

    saveButton().click();
    http.expectOne('/api/v1/settings').flush({ ...settings, easyFiles: 10 });
    await settle();
    await flushSync();

    http.expectNone('/api/v1/projects/1');
  });

  it('should_keep_form_dirty_and_not_navigate_when_a_rename_fails', async () => {
    await loadSettings(settings, [connection], [projectApi, projectWeb]);
    await expandConnection('GitLab');
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
    await expandConnection('GitLab');
    await type(repoAliasInputs()[0], 'back');
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);

    const pathInput = el.querySelector<HTMLInputElement>(
      '.add-fields input[formControlName="path"]',
    )!;
    pathInput.value = 'equipe/front-web';
    pathInput.dispatchEvent(new Event('input'));
    await settle();
    el.querySelector<HTMLButtonElement>('.add-submit')!.click();
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
