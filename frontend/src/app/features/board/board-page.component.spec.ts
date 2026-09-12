import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideI18nTesting, t } from '../../core/i18n/testing';
import { apiBaseUrlInterceptor } from '../../core/interceptors/api-base-url.interceptor';
import { httpErrorInterceptor } from '../../core/interceptors/http-error.interceptor';
import { MergeRequestView } from '../../models/merge-request.model';
import { Project } from '../../models/project.model';
import { Settings } from '../../models/settings.model';
import { SyncRun, SyncStatus } from '../../models/sync-status.model';
import { provideIcons } from '../../shared/icons/provide-icons';
import { FiltersStore } from '../../stores/filters.store';
import { SyncStore } from '../../stores/sync.store';
import { BoardPageComponent } from './board-page.component';
import { FilterBarComponent } from './filter-bar/filter-bar.component';

const NO_TOKEN_SETTINGS: Settings = {
  gitlabUrl: 'https://gitlab.exemple.fr',
  tokenConfigured: false,
  tokenHint: null,
  meUsername: null,
  meEmail: null,
};
const WITH_TOKEN_SETTINGS: Settings = {
  ...NO_TOKEN_SETTINGS,
  tokenConfigured: true,
  tokenHint: 'wxyz',
};
const WITH_IDENTITY_SETTINGS: Settings = {
  ...WITH_TOKEN_SETTINGS,
  meUsername: 'mdupont',
};
const PROJECT: Project = {
  id: 1,
  pathWithNamespace: 'equipe/backend-api',
  alias: 'api',
  gitlabProjectId: 42,
};
const IDLE_STATUS: SyncStatus = { running: false, lastRun: null, nextRunAt: null };
const MERGE_REQUESTS_URL = '/api/v1/merge-requests?drafts=0&mine=0&sort=ready:asc';
const FACETS_URL = '/api/v1/merge-requests/facets?drafts=0&mine=0';
const EMPTY_FACETS = {
  project: [],
  author: [],
  assigned: [{ value: 'nobody', label: 'Nobody', count: 0 }],
  approved: [
    { value: 'yes', label: 'Oui', count: 0 },
    { value: 'no', label: 'Non', count: 0 },
  ],
  commented: [
    { value: 'yes', label: 'Oui', count: 0 },
    { value: 'no', label: 'Non', count: 0 },
  ],
};
// Facets incluant l'option « api », pour que la réconciliation RG-010-09 ne
// retire pas silencieusement une sélection de projet valide.
const FACETS_WITH_API = {
  ...EMPTY_FACETS,
  project: [{ value: 'api', label: 'api · equipe/backend-api', count: 0 }],
};

function run(overrides: Partial<SyncRun> = {}): SyncRun {
  return {
    startedAt: '2026-09-11T08:00:00.000Z',
    finishedAt: '2026-09-11T08:00:05.000Z',
    status: 'success',
    mrCount: 3,
    errorMessage: null,
    trigger: 'manual',
    ...overrides,
  };
}

function mergeRequest(overrides: Partial<MergeRequestView> = {}): MergeRequestView {
  return {
    id: 1,
    projectAlias: 'api',
    iid: 7,
    title: 'Refonte facturation',
    webUrl: 'https://gitlab.com/equipe/api/-/merge_requests/7',
    draft: false,
    author: { username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
    reviewers: [],
    assignees: [],
    approved: false,
    commentsCount: 0,
    difficulty: 'easy',
    changedFiles: 1,
    additions: 1,
    deletions: 0,
    changedLines: 1,
    createdAt: '2026-09-01T10:00:00.000Z',
    readyAt: '2026-09-01T10:00:00.000Z',
    readyDays: 6,
    readyLevel: 'red',
    openedDays: 6,
    isMine: false,
    ...overrides,
  };
}

describe('BoardPageComponent', () => {
  let fixture: ComponentFixture<BoardPageComponent>;
  let el: HTMLElement;
  let http: HttpTestingController;
  const snackBar = { open: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [BoardPageComponent],
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
  });

  afterEach(() => {
    TestBed.inject(SyncStore).stopPolling();
    http.verify();
  });

  const settle = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };

  async function bootstrap(options: {
    settings: Settings;
    projects: Project[];
    status: SyncStatus;
    mergeRequests?: MergeRequestView[];
    warnings?: string[];
  }): Promise<void> {
    fixture = TestBed.createComponent(BoardPageComponent);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await settle();
    http.expectOne('/api/v1/settings').flush(options.settings);
    http.expectOne('/api/v1/projects').flush(options.projects);
    http
      .expectOne(MERGE_REQUESTS_URL)
      .flush({ mergeRequests: options.mergeRequests ?? [], warnings: options.warnings ?? [] });
    http.expectOne(FACETS_URL).flush(EMPTY_FACETS);
    http.expectOne('/api/v1/sync/status').flush(options.status);
    await settle();
  }

  it('should_show_the_no_token_banner_and_disable_refresh_when_no_token_is_configured', async () => {
    await bootstrap({ settings: NO_TOKEN_SETTINGS, projects: [], status: IDLE_STATUS });

    expect(el.querySelector('.no-token-banner')).not.toBeNull();
    expect(el.querySelector('.empty-state')).toBeNull();
    expect(
      el.querySelector<HTMLButtonElement>('button[mat-stroked-button]')?.disabled,
    ).toBe(true);
  });

  it('should_show_the_no_repos_empty_state_when_a_token_is_configured_but_no_repo_exists', async () => {
    await bootstrap({ settings: WITH_TOKEN_SETTINGS, projects: [], status: IDLE_STATUS });

    expect(el.querySelector('.no-token-banner')).toBeNull();
    expect(el.querySelector('.empty-state')).not.toBeNull();
    expect(el.querySelector('.empty-state p')?.textContent?.trim()).toBe(
      t('board.noRepos.title'),
    );
    expect(el.querySelector('app-filter-bar')).toBeNull();
    expect(
      el.querySelector<HTMLButtonElement>('button[mat-stroked-button]')?.disabled,
    ).toBe(false);
  });

  it('should_show_the_filter_bar_and_the_mr_table_when_merge_requests_are_returned', async () => {
    await bootstrap({
      settings: WITH_TOKEN_SETTINGS,
      projects: [PROJECT],
      status: IDLE_STATUS,
      mergeRequests: [mergeRequest()],
    });

    expect(el.querySelector('.no-token-banner')).toBeNull();
    expect(el.querySelector('.empty-state')).toBeNull();
    expect(el.querySelector('app-filter-bar')).not.toBeNull();
    expect(el.querySelector('app-mr-table')).not.toBeNull();
    expect(el.querySelector('.title-link')?.textContent?.trim()).toBe('Refonte facturation');
  });

  it('should_show_the_no_merge_requests_empty_state_without_a_clear_button_when_no_filter_is_active', async () => {
    await bootstrap({
      settings: WITH_TOKEN_SETTINGS,
      projects: [PROJECT],
      status: IDLE_STATUS,
      mergeRequests: [],
    });

    expect(el.querySelector('.no-token-banner')).toBeNull();
    expect(el.querySelector('app-mr-table table')).toBeNull();
    expect(el.querySelector('.empty-state p')?.textContent?.trim()).toBe(
      t('board.mergeRequests.empty'),
    );
    expect(el.querySelector('.empty-state button')).toBeNull();
  });

  it('should_pass_identity_configured_to_the_filter_bar', async () => {
    await bootstrap({
      settings: WITH_IDENTITY_SETTINGS,
      projects: [PROJECT],
      status: IDLE_STATUS,
    });

    const filterBar = el.querySelector('app-filter-bar');
    expect(filterBar?.querySelector('.mat-mdc-chip-disabled')).toBeNull();
  });

  it('should_disable_the_mine_chip_when_identity_is_not_configured', async () => {
    await bootstrap({
      settings: WITH_TOKEN_SETTINGS,
      projects: [PROJECT],
      status: IDLE_STATUS,
    });

    const filterBar = el.querySelector('app-filter-bar');
    expect(filterBar?.querySelector('.mat-mdc-chip-disabled')).not.toBeNull();
  });

  const waitForDebounce = () => new Promise((resolve) => setTimeout(resolve, 200));

  it('should_reload_with_drafts_1_after_toggling_the_drafts_chip', async () => {
    await bootstrap({ settings: WITH_TOKEN_SETTINGS, projects: [PROJECT], status: IDLE_STATUS });

    el.querySelector<HTMLElement>('app-filter-bar mat-chip-option button')?.click();
    await waitForDebounce();
    await settle();

    http
      .expectOne('/api/v1/merge-requests?drafts=1&mine=0&sort=ready:asc')
      .flush({ mergeRequests: [], warnings: [] });
    http.expectOne('/api/v1/merge-requests/facets?drafts=1&mine=0').flush(EMPTY_FACETS);
    await settle();
  });

  it('should_reload_with_mine_1_after_toggling_the_mine_chip', async () => {
    await bootstrap({
      settings: WITH_IDENTITY_SETTINGS,
      projects: [PROJECT],
      status: IDLE_STATUS,
      mergeRequests: [mergeRequest()],
    });

    const mineChip = Array.from(
      el.querySelectorAll<HTMLElement>('app-filter-bar mat-chip-option button'),
    )[1];
    mineChip.click();
    await waitForDebounce();
    await settle();

    http
      .expectOne('/api/v1/merge-requests?drafts=0&mine=1&sort=ready:asc')
      .flush({ mergeRequests: [], warnings: [] });
    http.expectOne('/api/v1/merge-requests/facets?drafts=0&mine=1').flush(EMPTY_FACETS);
    await settle();

    expect(el.querySelector('.empty-state p')?.textContent?.trim()).toBe(
      t('board.mergeRequests.emptyFiltered'),
    );
    expect(el.querySelector('.empty-state button')?.textContent?.trim()).toBe(
      t('board.mergeRequests.clearFilters'),
    );
  });

  it('should_reload_with_mine_0_when_the_clear_filters_button_is_clicked', async () => {
    await bootstrap({
      settings: WITH_IDENTITY_SETTINGS,
      projects: [PROJECT],
      status: IDLE_STATUS,
      mergeRequests: [],
    });
    // Force « Mes MRs » actif directement sur le store, sans repasser par un
    // cycle chip-clic + debounce + fetch : seul le comportement du bouton
    // « Effacer » est testé ici (déjà couvert isolément pour le chip lui-même).
    TestBed.inject(FiltersStore).toggleMine();
    fixture.detectChanges();
    await settle();

    const clearButton = el.querySelector<HTMLButtonElement>('.empty-state button');
    expect(clearButton?.textContent?.trim()).toBe(t('board.mergeRequests.clearFilters'));

    clearButton?.click();
    await waitForDebounce();
    await settle();

    http
      .expectOne('/api/v1/merge-requests?drafts=0&mine=0&sort=ready:asc')
      .flush({ mergeRequests: [mergeRequest()], warnings: [] });
    http.expectOne(FACETS_URL).flush(EMPTY_FACETS);
    await settle();
  });

  it('should_show_the_empty_state_with_a_clear_button_when_a_composable_filter_is_active_but_matches_nothing', async () => {
    await bootstrap({
      settings: WITH_TOKEN_SETTINGS,
      projects: [PROJECT],
      status: IDLE_STATUS,
      mergeRequests: [],
    });
    // RG-010-10 : au moins un filtre composable actif, comme « Mes MRs »,
    // doit basculer l'état vide sur le message filtré (déjà couvert pour
    // « Mes MRs » ci-dessus ; ici la logique est étendue à `active`).
    TestBed.inject(FiltersStore).addFilter('project');
    fixture.detectChanges();
    await settle();

    expect(el.querySelector('.empty-state p')?.textContent?.trim()).toBe(
      t('board.mergeRequests.emptyFiltered'),
    );
    expect(el.querySelector('.empty-state button')?.textContent?.trim()).toBe(
      t('board.mergeRequests.clearFilters'),
    );
  });

  it('should_reload_after_adding_removing_toggling_or_selecting_a_composable_filter', async () => {
    await bootstrap({ settings: WITH_TOKEN_SETTINGS, projects: [PROJECT], status: IDLE_STATUS });
    const filterBar = fixture.debugElement.query(By.directive(FilterBarComponent))
      .componentInstance as FilterBarComponent;

    filterBar.filterAdd.emit('project');
    await waitForDebounce();
    await settle();
    http
      .expectOne(
        (r) => r.url === '/api/v1/merge-requests' && !r.params.has('project'),
      )
      .flush({ mergeRequests: [], warnings: [] });
    http.expectOne((r) => r.url === '/api/v1/merge-requests/facets').flush(EMPTY_FACETS);
    await settle();

    expect(TestBed.inject(FiltersStore).active()).toEqual(['project']);

    filterBar.filterToggleValue.emit({ key: 'project', value: 'api' });
    await waitForDebounce();
    await settle();
    http
      .expectOne((r) => r.url === '/api/v1/merge-requests' && r.params.get('project') === 'api')
      .flush({ mergeRequests: [], warnings: [] });
    http.expectOne((r) => r.url === '/api/v1/merge-requests/facets').flush(FACETS_WITH_API);
    await settle();

    expect(TestBed.inject(FiltersStore).project()).toEqual(['api']);

    filterBar.filterSelectBoolean.emit({ key: 'approved', value: 'yes' });
    await waitForDebounce();
    await settle();
    http
      .expectOne((r) => r.url === '/api/v1/merge-requests' && r.params.get('approved') === '1')
      .flush({ mergeRequests: [], warnings: [] });
    http.expectOne((r) => r.url === '/api/v1/merge-requests/facets').flush(FACETS_WITH_API);
    await settle();

    expect(TestBed.inject(FiltersStore).approved()).toBe('yes');

    filterBar.filterRemove.emit('project');
    await waitForDebounce();
    await settle();
    http
      .expectOne((r) => r.url === '/api/v1/merge-requests' && !r.params.has('project'))
      .flush({ mergeRequests: [], warnings: [] });
    http.expectOne((r) => r.url === '/api/v1/merge-requests/facets').flush(EMPTY_FACETS);
    await settle();

    expect(TestBed.inject(FiltersStore).active()).toEqual([]);
  });

  it('should_toast_when_loading_merge_requests_fails', async () => {
    fixture = TestBed.createComponent(BoardPageComponent);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await settle();
    http.expectOne('/api/v1/settings').flush(WITH_TOKEN_SETTINGS);
    http.expectOne('/api/v1/projects').flush([PROJECT]);
    http.expectOne(MERGE_REQUESTS_URL).flush('down', { status: 500, statusText: 'KO' });
    http.expectOne(FACETS_URL).flush(EMPTY_FACETS);
    http.expectOne('/api/v1/sync/status').flush(IDLE_STATUS);
    await settle();

    expect(snackBar.open).toHaveBeenCalledWith(
      t('board.mergeRequests.loadError'),
      t('common.ok'),
      expect.anything(),
    );
  });

  it('should_trigger_an_unscoped_sync_and_reload_status_and_merge_requests_when_clicking_refresh', async () => {
    await bootstrap({ settings: WITH_TOKEN_SETTINGS, projects: [PROJECT], status: IDLE_STATUS });

    el.querySelector<HTMLButtonElement>('button[mat-stroked-button]')?.click();
    await settle();

    const syncReq = http.expectOne('/api/v1/sync');
    expect(syncReq.request.method).toBe('POST');
    syncReq.flush({ running: true }, { status: 202, statusText: 'Accepted' });
    await settle();
    http.expectOne('/api/v1/sync/status').flush({ running: true, lastRun: null, nextRunAt: null });
    await settle();
    // Rechargement automatique des MRs à la fin de cette (deuxième) transition
    // de statut, non-baseline cette fois (RG-005-06).
    http.expectOne(MERGE_REQUESTS_URL).flush({ mergeRequests: [], warnings: [] });
    http.expectOne(FACETS_URL).flush(EMPTY_FACETS);
    await settle();
  });

  it('should_not_toast_for_a_run_that_already_failed_before_the_page_was_opened', async () => {
    await bootstrap({
      settings: WITH_TOKEN_SETTINGS,
      projects: [PROJECT],
      status: { running: false, lastRun: run({ status: 'error' }), nextRunAt: null },
    });

    expect(snackBar.open).not.toHaveBeenCalled();
  });

  it('should_toast_and_reload_merge_requests_when_a_new_run_finishes_as_partial_or_error', async () => {
    await bootstrap({ settings: WITH_TOKEN_SETTINGS, projects: [PROJECT], status: IDLE_STATUS });

    const syncStore = TestBed.inject(SyncStore);
    void syncStore.loadStatus();
    await settle();
    http
      .expectOne('/api/v1/sync/status')
      .flush({
        running: false,
        lastRun: run({ status: 'partial', startedAt: '2026-09-11T09:00:00.000Z' }),
        nextRunAt: null,
      });
    await settle();
    http.expectOne(MERGE_REQUESTS_URL).flush({ mergeRequests: [], warnings: [] });
    http.expectOne(FACETS_URL).flush(EMPTY_FACETS);
    await settle();

    expect(snackBar.open).toHaveBeenCalledWith(
      t('board.sync.toastError'),
      t('common.ok'),
      expect.anything(),
    );
  });

  it('should_start_polling_on_init_and_stop_it_on_destroy', async () => {
    fixture = TestBed.createComponent(BoardPageComponent);
    const syncStore = TestBed.inject(SyncStore);
    const startSpy = vi.spyOn(syncStore, 'startPolling');
    const stopSpy = vi.spyOn(syncStore, 'stopPolling');

    fixture.detectChanges();
    await settle();
    http.expectOne('/api/v1/settings').flush(WITH_TOKEN_SETTINGS);
    http.expectOne('/api/v1/projects').flush([PROJECT]);
    http.expectOne(MERGE_REQUESTS_URL).flush({ mergeRequests: [], warnings: [] });
    http.expectOne(FACETS_URL).flush(EMPTY_FACETS);
    http.expectOne('/api/v1/sync/status').flush(IDLE_STATUS);
    await settle();

    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(stopSpy).not.toHaveBeenCalled();

    fixture.destroy();
    expect(stopSpy).toHaveBeenCalledTimes(1);
  });
});
