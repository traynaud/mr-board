import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltip } from '@angular/material/tooltip';
import { By, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { provideI18nTesting, t } from '../../core/i18n/testing';
import { apiBaseUrlInterceptor } from '../../core/interceptors/api-base-url.interceptor';
import { httpErrorInterceptor } from '../../core/interceptors/http-error.interceptor';
import { stubMatchMedia } from '../../core/theme/testing';
import { Connection } from '../../models/connection.model';
import { MergeRequestView } from '../../models/merge-request.model';
import { Project } from '../../models/project.model';
import { Settings } from '../../models/settings.model';
import { SyncRun, SyncStatus } from '../../models/sync-status.model';
import { provideIcons } from '../../shared/icons/provide-icons';
import { ColumnWidthsStore, DEFAULT_COLUMN_WIDTHS } from '../../stores/column-widths.store';
import { ColumnsStore } from '../../stores/columns.store';
import { FiltersStore } from '../../stores/filters.store';
import { SyncStore } from '../../stores/sync.store';
import { BoardPageComponent } from './board-page.component';
import { FilterBarComponent } from './filter-bar/filter-bar.component';
import { MrTableComponent } from './mr-table/mr-table.component';

const SETTINGS: Settings = {
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
const CONNECTION: Connection = {
  id: 1,
  type: 'gitlab',
  name: 'GitLab',
  url: 'https://gitlab.exemple.fr',
  tokenConfigured: true,
  tokenHint: 'wxyz',
  meUsername: null,
  projectsCount: 1,
};
const NO_CONNECTIONS: Connection[] = [];
const WITH_TOKEN_CONNECTIONS: Connection[] = [CONNECTION];
const WITHOUT_TOKEN_CONNECTIONS: Connection[] = [
  { ...CONNECTION, tokenConfigured: false, tokenHint: null },
];
const WITH_IDENTITY_CONNECTIONS: Connection[] = [{ ...CONNECTION, meUsername: 'mdupont' }];
const PROJECT: Project = {
  id: 1,
  connectionId: 1,
  pathWithNamespace: 'equipe/backend-api',
  alias: 'api',
  remoteProjectId: '42',
  color: null,
};
const IDLE_STATUS: SyncStatus = { running: false, lastRun: null, nextRunAt: null };
const CONNECTIONS_URL = '/api/v1/connections';
const MERGE_REQUESTS_URL = '/api/v1/merge-requests?drafts=0&mine=0&fav=0&sort=ready:asc';
const FACETS_URL = '/api/v1/merge-requests/facets?drafts=0&mine=0&fav=0';
const EMPTY_FACETS = {
  connection: [],
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
  label: [{ value: 'none', label: 'Sans label', count: 0 }],
};
// Facets incluant l'option « api », pour que la réconciliation RG-010-09 ne
// retire pas silencieusement une sélection de projet valide.
const FACETS_WITH_API = {
  ...EMPTY_FACETS,
  project: [{ value: 'api', label: 'api · equipe/backend-api', count: 0 }],
};
const MR_CONNECTION = { id: 1, name: 'GitLab', type: 'gitlab' as const };

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
    labels: [],
    author: { username: 'mdupont', name: 'Marie Dupont', avatarUrl: null, isMe: false },
    reviewers: [],
    assignees: [],
    approved: false,
    approvedBy: [],
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
    isFavorite: false,
    mergeStatus: { state: 'mergeable', reasons: [] },
    connection: MR_CONNECTION,
    ...overrides,
  };
}

describe('BoardPageComponent', () => {
  let fixture: ComponentFixture<BoardPageComponent>;
  let el: HTMLElement;
  let http: HttpTestingController;
  const snackBar = { open: vi.fn() };

  /**
   * Configure (ou reconfigure, après `TestBed.resetTestingModule()`) le
   * module de test. `activatedRoute` permet de fournir des query params
   * initiaux différents de ceux, vides, du `beforeEach` par défaut —
   * `ActivatedRoute` ne peut pas être remplacée après l'instanciation du
   * module (voir les tests de restauration ci-dessous).
   */
  async function configureBoardTestingModule(activatedRoute?: {
    snapshot: { queryParams: Record<string, string> };
  }): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [BoardPageComponent],
      providers: [
        provideRouter([]),
        ...(activatedRoute ? [{ provide: ActivatedRoute, useValue: activatedRoute }] : []),
        provideHttpClient(withInterceptors([apiBaseUrlInterceptor, httpErrorInterceptor])),
        provideHttpClientTesting(),
        provideI18nTesting(),
        provideIcons(),
        { provide: MatSnackBar, useValue: snackBar },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    stubMatchMedia(false);
    await configureBoardTestingModule();
  });

  afterEach(() => {
    TestBed.inject(SyncStore).stopPolling();
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.documentElement.removeAttribute('data-theme');
    vi.unstubAllGlobals();
    localStorage.clear();
    http.verify();
  });

  function setHidden(hidden: boolean): void {
    Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  const settle = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };

  async function bootstrap(options: {
    settings: Settings;
    connections?: Connection[];
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
    http.expectOne(CONNECTIONS_URL).flush(options.connections ?? WITH_TOKEN_CONNECTIONS);
    http.expectOne('/api/v1/projects').flush(options.projects);
    http
      .expectOne(MERGE_REQUESTS_URL)
      .flush({ mergeRequests: options.mergeRequests ?? [], warnings: options.warnings ?? [] });
    http.expectOne(FACETS_URL).flush(EMPTY_FACETS);
    http.expectOne('/api/v1/sync/status').flush(options.status);
    await settle();
  }

  it('should_show_the_no_token_banner_and_disable_refresh_when_no_connection_is_configured', async () => {
    await bootstrap({ settings: SETTINGS, connections: NO_CONNECTIONS, projects: [], status: IDLE_STATUS });

    expect(el.querySelector('.no-token-banner')).not.toBeNull();
    expect(el.querySelector('.empty-state')).toBeNull();
    expect(
      el.querySelector<HTMLButtonElement>('button[mat-stroked-button]')?.disabled,
    ).toBe(true);
  });

  it('should_show_a_non_blocking_banner_when_a_connection_has_no_token', async () => {
    await bootstrap({
      settings: SETTINGS,
      connections: WITHOUT_TOKEN_CONNECTIONS,
      projects: [],
      status: IDLE_STATUS,
    });

    expect(el.querySelector('.no-token-banner')).not.toBeNull();
    // RG-019-17 : contrairement à l'absence totale de connexion, Rafraîchir
    // reste actif quand seule une connexion existante manque de jeton.
    expect(
      el.querySelector<HTMLButtonElement>('button[mat-stroked-button]')?.disabled,
    ).toBe(false);
  });

  it('should_show_the_no_repos_empty_state_when_a_token_is_configured_but_no_repo_exists', async () => {
    await bootstrap({ settings: SETTINGS, projects: [], status: IDLE_STATUS });

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
      settings: SETTINGS,
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

  it('should_show_the_forge_icon_the_connection_filter_and_a_named_tooltip_with_two_connections_of_different_types_rg_021_01_02_03', async () => {
    const githubConnection: Connection = {
      ...CONNECTION,
      id: 2,
      type: 'github',
      name: 'github.com',
    };
    const githubProject: Project = {
      id: 2,
      connectionId: 2,
      pathWithNamespace: 'exemple-org/web',
      alias: 'web',
      remoteProjectId: '99',
      color: null,
    };
    const githubMr = mergeRequest({
      id: 2,
      iid: 8,
      projectAlias: 'web',
      title: 'Migration CI',
      connection: { id: 2, name: 'github.com', type: 'github' },
    });

    fixture = TestBed.createComponent(BoardPageComponent);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await settle();
    http.expectOne('/api/v1/settings').flush(SETTINGS);
    http.expectOne(CONNECTIONS_URL).flush([CONNECTION, githubConnection]);
    http.expectOne('/api/v1/projects').flush([PROJECT, githubProject]);
    http
      .expectOne(MERGE_REQUESTS_URL)
      .flush({ mergeRequests: [mergeRequest(), githubMr], warnings: [] });
    http.expectOne(FACETS_URL).flush({
      ...EMPTY_FACETS,
      connection: [
        { value: 'github.com', label: 'github.com', count: 1 },
        { value: 'GitLab', label: 'GitLab', count: 1 },
      ],
    });
    http.expectOne('/api/v1/sync/status').flush(IDLE_STATUS);
    await settle();

    // RG-021-01 : icône de forge sur chaque tag projet, dès 2 types de forge.
    const icons = Array.from(
      el.querySelectorAll<HTMLElement>('app-mr-table .tag-neutral mat-icon.forge-icon'),
    );
    expect(icons.map((icon) => icon.getAttribute('data-mat-icon-name')).sort()).toEqual([
      'github',
      'gitlab',
    ]);

    // RG-021-02 : l'infobulle nomme la connexion dès qu'il y en a au moins deux.
    const tags = fixture.debugElement.queryAll(By.css('app-mr-table .tag-neutral'));
    const tooltips = tags.map((tag) => tag.injector.get(MatTooltip).message);
    expect(tooltips).toEqual(
      expect.arrayContaining(['GitLab · equipe/backend-api', 'github.com · exemple-org/web']),
    );

    // RG-021-03 : le filtre « Connexion » est proposé dans le menu (rendu dans l'overlay CDK, hors `el`).
    const addFilterButton = el.querySelector<HTMLButtonElement>('.add-filter-button');
    addFilterButton?.click();
    await settle();
    expect(document.body.textContent).toContain(t('board.filters.pills.names.connection'));
  });

  it('should_open_the_title_link_in_a_new_tab_when_configured', async () => {
    await bootstrap({
      settings: { ...SETTINGS, openInNewTab: true },
      projects: [PROJECT],
      status: IDLE_STATUS,
      mergeRequests: [mergeRequest()],
    });

    expect(
      el.querySelector<HTMLAnchorElement>('.title-link')?.getAttribute('target'),
    ).toBe('_blank');
  });

  it('should_show_the_no_merge_requests_empty_state_without_a_clear_button_when_no_filter_is_active', async () => {
    await bootstrap({
      settings: SETTINGS,
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
      settings: SETTINGS,
      connections: WITH_IDENTITY_CONNECTIONS,
      projects: [PROJECT],
      status: IDLE_STATUS,
    });

    const filterBar = el.querySelector('app-filter-bar');
    expect(filterBar?.querySelector('.mat-mdc-chip-disabled')).toBeNull();
  });

  it('should_disable_the_mine_chip_when_identity_is_not_configured', async () => {
    await bootstrap({
      settings: SETTINGS,
      projects: [PROJECT],
      status: IDLE_STATUS,
    });

    const filterBar = el.querySelector('app-filter-bar');
    expect(filterBar?.querySelector('.mat-mdc-chip-disabled')).not.toBeNull();
  });

  const waitForDebounce = () => new Promise((resolve) => setTimeout(resolve, 200));
  /** RG-026-09 : la recherche attend 300 ms, plus long que les autres filtres. */
  const waitForSearchDebounce = () => new Promise((resolve) => setTimeout(resolve, 350));

  it('should_reload_with_drafts_1_after_toggling_the_drafts_chip', async () => {
    await bootstrap({ settings: SETTINGS, projects: [PROJECT], status: IDLE_STATUS });

    el.querySelector<HTMLElement>('app-filter-bar mat-chip-option button')?.click();
    await waitForDebounce();
    await settle();

    http
      .expectOne('/api/v1/merge-requests?drafts=1&mine=0&fav=0&sort=ready:asc')
      .flush({ mergeRequests: [], warnings: [] });
    http.expectOne('/api/v1/merge-requests/facets?drafts=1&mine=0&fav=0').flush(EMPTY_FACETS);
    await settle();
  });

  it('should_reload_with_mine_1_after_toggling_the_mine_chip', async () => {
    await bootstrap({
      settings: SETTINGS,
      connections: WITH_IDENTITY_CONNECTIONS,
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
      .expectOne('/api/v1/merge-requests?drafts=0&mine=1&fav=0&sort=ready:asc')
      .flush({ mergeRequests: [], warnings: [] });
    http.expectOne('/api/v1/merge-requests/facets?drafts=0&mine=1&fav=0').flush(EMPTY_FACETS);
    await settle();

    expect(el.querySelector('.empty-state p')?.textContent?.trim()).toBe(
      t('board.mergeRequests.emptyFiltered'),
    );
    expect(el.querySelector('.empty-state button')?.textContent?.trim()).toBe(
      t('board.mergeRequests.clearFilters'),
    );
  });

  it('should_reload_with_fav_1_after_toggling_the_favorites_chip_rg_027_10', async () => {
    await bootstrap({ settings: SETTINGS, projects: [PROJECT], status: IDLE_STATUS });

    const favoritesChip = Array.from(
      el.querySelectorAll<HTMLElement>('app-filter-bar mat-chip-option button'),
    )[2];
    favoritesChip.click();
    await waitForDebounce();
    await settle();

    http
      .expectOne('/api/v1/merge-requests?drafts=0&mine=0&fav=1&sort=ready:asc')
      .flush({ mergeRequests: [], warnings: [] });
    http.expectOne('/api/v1/merge-requests/facets?drafts=0&mine=0&fav=1').flush(EMPTY_FACETS);
    await settle();
  });

  it('should_call_set_favorite_and_update_the_star_when_the_favorite_button_is_clicked_rg_027_08', async () => {
    await bootstrap({
      settings: SETTINGS,
      projects: [PROJECT],
      status: IDLE_STATUS,
      mergeRequests: [mergeRequest({ id: 5, isFavorite: false })],
    });

    el.querySelector<HTMLButtonElement>('.favorite-toggle')?.click();
    await settle();

    const req = http.expectOne('/api/v1/merge-requests/5/favorite');
    expect(req.request.method).toBe('PUT');
    req.flush(null);
    await settle();

    expect(el.querySelector<HTMLElement>('.favorite-icon')?.classList.contains('active')).toBe(
      true,
    );
  });

  it('should_toast_an_error_and_roll_back_the_star_when_the_toggle_fails_rg_027_09', async () => {
    await bootstrap({
      settings: SETTINGS,
      projects: [PROJECT],
      status: IDLE_STATUS,
      mergeRequests: [mergeRequest({ id: 5, isFavorite: false })],
    });

    el.querySelector<HTMLButtonElement>('.favorite-toggle')?.click();
    await settle();

    http
      .expectOne('/api/v1/merge-requests/5/favorite')
      .flush('down', { status: 500, statusText: 'KO' });
    await settle();

    expect(el.querySelector<HTMLElement>('.favorite-icon')?.classList.contains('active')).toBe(
      false,
    );
    expect(snackBar.open).toHaveBeenCalledWith(
      t('errors.unexpected'),
      t('common.ok'),
      expect.anything(),
    );
  });

  it('should_reload_with_mine_0_when_the_clear_filters_button_is_clicked', async () => {
    await bootstrap({
      settings: SETTINGS,
      connections: WITH_IDENTITY_CONNECTIONS,
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
      .expectOne(MERGE_REQUESTS_URL)
      .flush({ mergeRequests: [mergeRequest()], warnings: [] });
    http.expectOne(FACETS_URL).flush(EMPTY_FACETS);
    await settle();
  });

  it('should_remove_the_search_filter_and_its_text_when_the_clear_filters_button_is_clicked_rg_026_11', async () => {
    await bootstrap({
      settings: SETTINGS,
      projects: [PROJECT],
      status: IDLE_STATUS,
      mergeRequests: [],
    });
    TestBed.inject(FiltersStore).addFilter('search');
    TestBed.inject(FiltersStore).setSearch('facturation');
    fixture.detectChanges();
    await settle();

    const searchInput = el.querySelector<HTMLInputElement>('.search-field input');
    expect(searchInput?.value).toBe('facturation');

    const clearButton = el.querySelector<HTMLButtonElement>('.empty-state button');
    clearButton?.click();
    await waitForDebounce();
    await settle();

    expect(TestBed.inject(FiltersStore).search()).toBe('');
    // RG-026-01 : « Titre » est un filtre comme les autres — « Effacer » le
    // retire complètement de la barre, le champ disparaît (pas seulement vidé).
    expect(el.querySelector('.search-field')).toBeNull();

    http
      .expectOne((r) => r.url === '/api/v1/merge-requests' && !r.params.has('q'))
      .flush({ mergeRequests: [mergeRequest()], warnings: [] });
    http.expectOne(FACETS_URL).flush(EMPTY_FACETS);
    await settle();
  });

  it('should_not_touch_other_active_filters_when_the_search_field_is_cleared_alone_rg_026_11', async () => {
    await bootstrap({ settings: SETTINGS, projects: [PROJECT], status: IDLE_STATUS });
    TestBed.inject(FiltersStore).addFilter('project');
    TestBed.inject(FiltersStore).toggleMultiValue('project', 'api');
    TestBed.inject(FiltersStore).addFilter('search');
    TestBed.inject(FiltersStore).setSearch('facturation');
    fixture.detectChanges();
    await settle();

    const filterBar = fixture.debugElement.query(By.directive(FilterBarComponent))
      .componentInstance as FilterBarComponent;
    filterBar.searchChange.emit('');
    // Pas de waitForDebounce : le rechargement est immédiat (0 ms) puisque
    // la recherche redevient vide (RG-026-09).
    await settle();

    http
      .expectOne(
        (r) =>
          r.url === '/api/v1/merge-requests' &&
          !r.params.has('q') &&
          r.params.get('project') === 'api',
      )
      .flush({ mergeRequests: [], warnings: [] });
    http.expectOne((r) => r.url === '/api/v1/merge-requests/facets').flush(FACETS_WITH_API);
    await settle();

    expect(TestBed.inject(FiltersStore).project()).toEqual(['api']);
    expect(TestBed.inject(FiltersStore).search()).toBe('');
  });

  it('should_show_the_empty_state_with_a_clear_button_when_a_composable_filter_is_active_but_matches_nothing', async () => {
    await bootstrap({
      settings: SETTINGS,
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

  it('should_show_the_empty_state_with_a_clear_button_when_a_search_is_active_but_matches_nothing_rg_026_12', async () => {
    await bootstrap({
      settings: SETTINGS,
      projects: [PROJECT],
      status: IDLE_STATUS,
      mergeRequests: [],
    });
    TestBed.inject(FiltersStore).addFilter('search');
    TestBed.inject(FiltersStore).setSearch('zzzzz');
    fixture.detectChanges();
    await settle();

    expect(el.querySelector('.empty-state p')?.textContent?.trim()).toBe(
      t('board.mergeRequests.emptyFiltered'),
    );
    expect(el.querySelector('.empty-state button')?.textContent?.trim()).toBe(
      t('board.mergeRequests.clearFilters'),
    );
  });

  it('should_reload_with_q_after_a_search_change_debounced_at_300ms_rg_026_09', async () => {
    await bootstrap({ settings: SETTINGS, projects: [PROJECT], status: IDLE_STATUS });
    const filterBar = fixture.debugElement.query(By.directive(FilterBarComponent))
      .componentInstance as FilterBarComponent;

    filterBar.searchChange.emit('facturation');
    await waitForSearchDebounce();
    await settle();

    http
      .expectOne((r) => r.url === '/api/v1/merge-requests' && r.params.get('q') === 'facturation')
      .flush({ mergeRequests: [], warnings: [] });
    http.expectOne((r) => r.url === '/api/v1/merge-requests/facets').flush(EMPTY_FACETS);
    await settle();

    expect(TestBed.inject(FiltersStore).search()).toBe('facturation');
  });

  it('should_reload_immediately_when_the_search_becomes_empty_rg_026_09', async () => {
    await bootstrap({ settings: SETTINGS, projects: [PROJECT], status: IDLE_STATUS });
    const filterBar = fixture.debugElement.query(By.directive(FilterBarComponent))
      .componentInstance as FilterBarComponent;
    filterBar.searchChange.emit('facturation');
    await waitForSearchDebounce();
    await settle();
    http.expectOne((r) => r.url === '/api/v1/merge-requests').flush({ mergeRequests: [], warnings: [] });
    http.expectOne((r) => r.url === '/api/v1/merge-requests/facets').flush(EMPTY_FACETS);
    await settle();

    filterBar.searchChange.emit('');
    // Pas de waitForSearchDebounce : le rechargement est immédiat (0 ms).
    await settle();

    http
      .expectOne((r) => r.url === '/api/v1/merge-requests' && !r.params.has('q'))
      .flush({ mergeRequests: [], warnings: [] });
    http.expectOne((r) => r.url === '/api/v1/merge-requests/facets').flush(EMPTY_FACETS);
    await settle();

    expect(TestBed.inject(FiltersStore).search()).toBe('');
  });

  it('should_reload_after_adding_removing_toggling_or_selecting_a_composable_filter', async () => {
    await bootstrap({ settings: SETTINGS, projects: [PROJECT], status: IDLE_STATUS });
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

  describe('URL state (US-011)', () => {
    it('should_restore_drafts_mine_filters_sort_and_columns_from_the_url_before_the_first_load', async () => {
      TestBed.resetTestingModule();
      await configureBoardTestingModule({
        snapshot: {
          queryParams: { drafts: '1', mine: '1', project: 'api,web', sort: 'diff:desc', cols: 'opened' },
        },
      });

      fixture = TestBed.createComponent(BoardPageComponent);
      el = fixture.nativeElement as HTMLElement;
      fixture.detectChanges();
      await settle();
      http.expectOne('/api/v1/settings').flush(SETTINGS);
      http.expectOne(CONNECTIONS_URL).flush(WITH_TOKEN_CONNECTIONS);
      http.expectOne('/api/v1/projects').flush([PROJECT]);
      const mrReq = http.expectOne((r) => r.url === '/api/v1/merge-requests');
      expect(mrReq.request.params.get('drafts')).toBe('1');
      expect(mrReq.request.params.get('mine')).toBe('1');
      expect(mrReq.request.params.get('project')).toBe('api,web');
      expect(mrReq.request.params.get('sort')).toBe('diff:desc');
      mrReq.flush({ mergeRequests: [], warnings: [] });
      const facetsReq = http.expectOne((r) => r.url === '/api/v1/merge-requests/facets');
      expect(facetsReq.request.params.get('drafts')).toBe('1');
      expect(facetsReq.request.params.get('project')).toBe('api,web');
      // Facets incluant « api »/« web », pour que la réconciliation RG-010-09
      // ne retire pas silencieusement la sélection restaurée depuis l'URL.
      facetsReq.flush({
        ...EMPTY_FACETS,
        project: [
          { value: 'api', label: 'api · equipe/api', count: 0 },
          { value: 'web', label: 'web · equipe/web', count: 0 },
        ],
      });
      http.expectOne('/api/v1/sync/status').flush(IDLE_STATUS);
      await settle();

      expect(TestBed.inject(FiltersStore).active()).toEqual(['project']);
      expect(TestBed.inject(FiltersStore).project()).toEqual(['api', 'web']);
      // Scenario: Restauration depuis l'URL (RG-017-09) — `cols=opened`
      // masque Statut et affiche Ouverte.
      expect(TestBed.inject(ColumnsStore).showStatus()).toBe(false);
      expect(TestBed.inject(ColumnsStore).showOpened()).toBe(true);
    });

    it('should_restore_the_search_from_the_url_before_the_first_load_rg_026_10', async () => {
      TestBed.resetTestingModule();
      await configureBoardTestingModule({
        snapshot: { queryParams: { q: 'facturation' } },
      });

      fixture = TestBed.createComponent(BoardPageComponent);
      el = fixture.nativeElement as HTMLElement;
      fixture.detectChanges();
      await settle();
      http.expectOne('/api/v1/settings').flush(SETTINGS);
      http.expectOne(CONNECTIONS_URL).flush(WITH_TOKEN_CONNECTIONS);
      http.expectOne('/api/v1/projects').flush([PROJECT]);
      const mrReq = http.expectOne((r) => r.url === '/api/v1/merge-requests');
      expect(mrReq.request.params.get('q')).toBe('facturation');
      mrReq.flush({ mergeRequests: [], warnings: [] });
      http.expectOne((r) => r.url === '/api/v1/merge-requests/facets').flush(EMPTY_FACETS);
      http.expectOne('/api/v1/sync/status').flush(IDLE_STATUS);
      await settle();

      expect(TestBed.inject(FiltersStore).search()).toBe('facturation');
    });

    it('should_restore_fav_1_from_the_url_before_the_first_load_rg_027_11', async () => {
      TestBed.resetTestingModule();
      await configureBoardTestingModule({
        snapshot: { queryParams: { fav: '1' } },
      });

      fixture = TestBed.createComponent(BoardPageComponent);
      el = fixture.nativeElement as HTMLElement;
      fixture.detectChanges();
      await settle();
      http.expectOne('/api/v1/settings').flush(SETTINGS);
      http.expectOne(CONNECTIONS_URL).flush(WITH_TOKEN_CONNECTIONS);
      http.expectOne('/api/v1/projects').flush([PROJECT]);
      const mrReq = http.expectOne((r) => r.url === '/api/v1/merge-requests');
      expect(mrReq.request.params.get('fav')).toBe('1');
      mrReq.flush({ mergeRequests: [], warnings: [] });
      http.expectOne((r) => r.url === '/api/v1/merge-requests/facets').flush(EMPTY_FACETS);
      http.expectOne('/api/v1/sync/status').flush(IDLE_STATUS);
      await settle();

      expect(TestBed.inject(FiltersStore).favorites()).toBe(true);
    });

    it('should_write_the_url_with_default_params_and_replaceUrl_on_the_very_first_load', async () => {
      // Espionné avant toute création de composant : capture l'appel émis
      // par le premier passage de l'effet d'écriture d'URL, sans changement
      // de filtre préalable (RG-011-02, « URL complétée par défaut »).
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      await bootstrap({ settings: SETTINGS, projects: [PROJECT], status: IDLE_STATUS });

      expect(navigateSpy).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: { drafts: '0', mine: '0', fav: '0', sort: 'ready:asc' },
          replaceUrl: true,
        }),
      );
    });

    it('should_write_the_url_without_pushing_history_when_a_filter_changes', async () => {
      await bootstrap({ settings: SETTINGS, projects: [PROJECT], status: IDLE_STATUS });
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      TestBed.inject(FiltersStore).toggleMine();
      await settle();

      expect(navigateSpy).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: expect.objectContaining({ drafts: '0', mine: '1', sort: 'ready:asc' }),
          replaceUrl: true,
        }),
      );
    });

    it('should_prune_a_renamed_project_alias_from_both_the_selection_and_the_rewritten_url', async () => {
      // RG-010-09 (US-010) + réactivité de l'effet d'écriture d'URL
      // (US-011) combinées de bout en bout : « api » a été renommé/retiré,
      // il n'apparaît plus dans la réponse `facets`.
      TestBed.resetTestingModule();
      await configureBoardTestingModule({ snapshot: { queryParams: { project: 'api' } } });
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      fixture = TestBed.createComponent(BoardPageComponent);
      el = fixture.nativeElement as HTMLElement;
      fixture.detectChanges();
      await settle();
      http.expectOne('/api/v1/settings').flush(SETTINGS);
      http.expectOne(CONNECTIONS_URL).flush(WITH_TOKEN_CONNECTIONS);
      http.expectOne('/api/v1/projects').flush([PROJECT]);
      const mrReq = http.expectOne((r) => r.url === '/api/v1/merge-requests');
      expect(mrReq.request.params.get('project')).toBe('api');
      mrReq.flush({ mergeRequests: [], warnings: [] });
      const facetsReq = http.expectOne((r) => r.url === '/api/v1/merge-requests/facets');
      facetsReq.flush({
        ...EMPTY_FACETS,
        project: [{ value: 'back', label: 'back · equipe/back', count: 0 }],
      });
      http.expectOne('/api/v1/sync/status').flush(IDLE_STATUS);
      await settle();

      expect(TestBed.inject(FiltersStore).active()).toEqual(['project']);
      expect(TestBed.inject(FiltersStore).project()).toEqual([]);
      // RG-011-01 : un filtre actif sans valeur reste présent (« project= »),
      // il n'est pas retiré de l'URL — seule sa valeur est vidée.
      expect(navigateSpy).toHaveBeenLastCalledWith(
        [],
        expect.objectContaining({
          queryParams: expect.objectContaining({ project: '' }),
          replaceUrl: true,
        }),
      );
    });

    it('should_show_the_current_query_string_in_the_footer', async () => {
      await bootstrap({
        settings: SETTINGS,
        projects: [PROJECT],
        status: IDLE_STATUS,
        mergeRequests: [mergeRequest()],
      });

      expect(el.querySelector('.board-footer .query-string')?.textContent?.trim()).toBe(
        '?drafts=0&mine=0&fav=0&sort=ready:asc',
      );
    });

    it('should_not_show_the_footer_in_the_no_repos_empty_state', async () => {
      await bootstrap({ settings: SETTINGS, projects: [], status: IDLE_STATUS });

      expect(el.querySelector('.board-footer')).toBeNull();
    });

    it('should_mention_the_highlight_ring_in_the_footer_when_highlight_me_is_enabled', async () => {
      await bootstrap({
        settings: { ...SETTINGS, highlightMe: true },
        projects: [PROJECT],
        status: IDLE_STATUS,
        mergeRequests: [mergeRequest()],
      });

      expect(el.querySelector('.board-footer span')?.textContent?.trim()).toBe(
        t('board.footer.legendHighlighted'),
      );
    });

    it('should_not_mention_the_highlight_ring_in_the_footer_when_highlight_me_is_disabled', async () => {
      await bootstrap({
        settings: { ...SETTINGS, highlightMe: false },
        projects: [PROJECT],
        status: IDLE_STATUS,
        mergeRequests: [mergeRequest()],
      });

      expect(el.querySelector('.board-footer span')?.textContent?.trim()).toBe(
        t('board.footer.legend'),
      );
    });

    it('should_toggle_the_opened_column_from_the_mr_table_menu_output', async () => {
      await bootstrap({
        settings: SETTINGS,
        projects: [PROJECT],
        status: IDLE_STATUS,
        mergeRequests: [mergeRequest()],
      });

      expect(TestBed.inject(ColumnsStore).showOpened()).toBe(false);

      const mrTable = fixture.debugElement.query(By.directive(MrTableComponent))
        .componentInstance as MrTableComponent;
      mrTable.toggleOpenedColumn.emit();
      await settle();

      // Scenario: Afficher Ouverte en gardant Statut (RG-017-09) — Statut
      // reste visible (défaut), donc `cols` liste les deux colonnes.
      expect(TestBed.inject(ColumnsStore).showOpened()).toBe(true);
      expect(el.querySelector('.board-footer .query-string')?.textContent?.trim()).toContain(
        'cols=status,opened',
      );
    });

    it('should_toggle_the_status_column_from_the_mr_table_menu_output', async () => {
      await bootstrap({
        settings: SETTINGS,
        projects: [PROJECT],
        status: IDLE_STATUS,
        mergeRequests: [mergeRequest()],
      });

      expect(TestBed.inject(ColumnsStore).showStatus()).toBe(true);

      const mrTable = fixture.debugElement.query(By.directive(MrTableComponent))
        .componentInstance as MrTableComponent;
      mrTable.toggleStatusColumn.emit();
      await settle();

      // Scenario: Masquer la colonne (RG-017-09).
      expect(TestBed.inject(ColumnsStore).showStatus()).toBe(false);
      expect(el.querySelector('.board-footer .query-string')?.textContent?.trim()).toContain('cols=none');
    });
  });

  describe('column widths (US-012)', () => {
    beforeEach(() => {
      // `ColumnWidthsStore` persiste dans le vrai `localStorage` de
      // l'environnement jsdom, partagé entre les tests d'un même fichier.
      localStorage.clear();
    });

    it('should_pass_the_effective_column_widths_to_the_mr_table', async () => {
      await bootstrap({
        settings: SETTINGS,
        projects: [PROJECT],
        status: IDLE_STATUS,
        mergeRequests: [mergeRequest()],
      });
      TestBed.inject(ColumnWidthsStore).setWidth('project', 120);
      await settle();

      const mrTable = fixture.debugElement.query(By.directive(MrTableComponent))
        .componentInstance as MrTableComponent;
      expect(mrTable.columnWidths().project).toBe(120);
    });

    it('should_widen_by_24px_after_3_cumulative_arrow_right_presses_on_a_handle', async () => {
      // Bout en bout via le vrai DOM et le vrai `ColumnWidthsStore` (pas de
      // simulation isolée) : `columnWidths` vient d'un `computed()` relu à
      // chaque re-rendu, donc chaque pression part bien de la largeur mise à
      // jour par la précédente (RG-012-07 : « 3 fois » → +24px cumulés).
      await bootstrap({
        settings: SETTINGS,
        projects: [PROJECT],
        status: IDLE_STATUS,
        mergeRequests: [mergeRequest()],
      });
      const reviewerAriaLabel = t('board.columns.resizeAriaLabel', {
        name: t('board.mergeRequests.columns.reviewer'),
      });
      const handle = el.querySelector<HTMLElement>(`[aria-label="${reviewerAriaLabel}"]`);

      for (let i = 0; i < 3; i += 1) {
        handle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        await settle();
      }

      expect(TestBed.inject(ColumnWidthsStore).widths().reviewer).toBe(
        DEFAULT_COLUMN_WIDTHS.reviewer + 24,
      );
    });

    it('should_forward_widthChange_from_the_mr_table_to_the_store', async () => {
      await bootstrap({
        settings: SETTINGS,
        projects: [PROJECT],
        status: IDLE_STATUS,
        mergeRequests: [mergeRequest()],
      });

      const mrTable = fixture.debugElement.query(By.directive(MrTableComponent))
        .componentInstance as MrTableComponent;
      mrTable.widthChange.emit({ key: 'author', width: 90 });
      await settle();

      expect(TestBed.inject(ColumnWidthsStore).widths().author).toBe(90);
    });

    it('should_forward_resetColumnWidth_from_the_mr_table_to_the_store', async () => {
      await bootstrap({
        settings: SETTINGS,
        projects: [PROJECT],
        status: IDLE_STATUS,
        mergeRequests: [mergeRequest()],
      });
      TestBed.inject(ColumnWidthsStore).setWidth('author', 90);
      await settle();

      const mrTable = fixture.debugElement.query(By.directive(MrTableComponent))
        .componentInstance as MrTableComponent;
      mrTable.resetColumnWidth.emit('author');
      await settle();

      expect(TestBed.inject(ColumnWidthsStore).widths().author).toBe(
        DEFAULT_COLUMN_WIDTHS.author,
      );
    });

    it('should_forward_resetAllWidths_from_the_mr_table_to_the_store', async () => {
      await bootstrap({
        settings: SETTINGS,
        projects: [PROJECT],
        status: IDLE_STATUS,
        mergeRequests: [mergeRequest()],
      });
      TestBed.inject(ColumnWidthsStore).setWidth('author', 90);
      await settle();

      const mrTable = fixture.debugElement.query(By.directive(MrTableComponent))
        .componentInstance as MrTableComponent;
      mrTable.resetAllWidths.emit();
      await settle();

      expect(TestBed.inject(ColumnWidthsStore).widths()).toEqual(DEFAULT_COLUMN_WIDTHS);
    });
  });

  it('should_toast_when_loading_merge_requests_fails', async () => {
    fixture = TestBed.createComponent(BoardPageComponent);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await settle();
    http.expectOne('/api/v1/settings').flush(SETTINGS);
    http.expectOne(CONNECTIONS_URL).flush(WITH_TOKEN_CONNECTIONS);
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
    await bootstrap({ settings: SETTINGS, projects: [PROJECT], status: IDLE_STATUS });

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

  it('should_apply_and_persist_the_theme_immediately_when_clicking_the_toolbar_toggle', async () => {
    await bootstrap({ settings: SETTINGS, projects: [PROJECT], status: IDLE_STATUS });

    el.querySelector<HTMLButtonElement>('app-board-toolbar button[mat-icon-button]')?.click();
    await settle();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    const req = http.expectOne('/api/v1/settings');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ theme: 'dark' });
    req.flush({ ...SETTINGS, theme: 'dark' });
    await settle();

    expect(snackBar.open).not.toHaveBeenCalled();
  });

  it('should_toast_an_error_and_keep_the_optimistic_theme_when_the_toggle_save_fails', async () => {
    await bootstrap({ settings: SETTINGS, projects: [PROJECT], status: IDLE_STATUS });

    el.querySelector<HTMLButtonElement>('app-board-toolbar button[mat-icon-button]')?.click();
    await settle();

    http.expectOne('/api/v1/settings').flush('down', { status: 500, statusText: 'KO' });
    await settle();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(snackBar.open).toHaveBeenCalledWith(
      t('errors.unexpected'),
      t('common.ok'),
      expect.anything(),
    );
  });

  it('should_not_toast_for_a_run_that_already_failed_before_the_page_was_opened', async () => {
    await bootstrap({
      settings: SETTINGS,
      projects: [PROJECT],
      status: { running: false, lastRun: run({ status: 'error' }), nextRunAt: null },
    });

    expect(snackBar.open).not.toHaveBeenCalled();
  });

  it('should_toast_and_reload_merge_requests_when_a_new_run_finishes_as_partial_or_error', async () => {
    await bootstrap({ settings: SETTINGS, projects: [PROJECT], status: IDLE_STATUS });

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
      t('board.sync.toastPartial'),
      t('common.ok'),
      expect.anything(),
    );
  });

  it('should_include_the_error_message_in_the_sync_failure_toast_rg_021_06', async () => {
    await bootstrap({ settings: SETTINGS, projects: [PROJECT], status: IDLE_STATUS });

    const syncStore = TestBed.inject(SyncStore);
    void syncStore.loadStatus();
    await settle();
    http.expectOne('/api/v1/sync/status').flush({
      running: false,
      lastRun: run({
        status: 'error',
        startedAt: '2026-09-11T09:00:00.000Z',
        errorMessage: 'front-web: Jeton refusé (github.com)',
      }),
      nextRunAt: null,
    });
    await settle();
    http.expectOne(MERGE_REQUESTS_URL).flush({ mergeRequests: [], warnings: [] });
    http.expectOne(FACETS_URL).flush(EMPTY_FACETS);
    await settle();

    expect(snackBar.open).toHaveBeenCalledWith(
      `${t('board.sync.toastError')} front-web: Jeton refusé (github.com)`,
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
    http.expectOne('/api/v1/settings').flush(SETTINGS);
    http.expectOne(CONNECTIONS_URL).flush(WITH_TOKEN_CONNECTIONS);
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

  it('should_pause_polling_when_the_tab_becomes_hidden_and_pauseWhenHidden_is_enabled', async () => {
    await bootstrap({ settings: SETTINGS, projects: [PROJECT], status: IDLE_STATUS });
    const stopSpy = vi.spyOn(TestBed.inject(SyncStore), 'stopPolling');

    setHidden(true);

    expect(stopSpy).toHaveBeenCalledTimes(1);
  });

  it('should_resume_polling_and_reload_merge_requests_when_the_tab_becomes_visible_again', async () => {
    await bootstrap({ settings: SETTINGS, projects: [PROJECT], status: IDLE_STATUS });
    const syncStore = TestBed.inject(SyncStore);
    const startSpy = vi.spyOn(syncStore, 'startPolling');
    setHidden(true);

    setHidden(false);
    await settle();
    // La relecture immédiate du statut (`startPolling`) fait passer `loading`
    // à `false`, ce qui redéclenche déjà `loadMergeRequests()` via l'effect
    // RG-005-06 — pas de second appel explicite (voir board-page.component.ts).
    http.expectOne('/api/v1/sync/status').flush(IDLE_STATUS);
    await settle();
    http.expectOne(MERGE_REQUESTS_URL).flush({ mergeRequests: [], warnings: [] });
    http.expectOne(FACETS_URL).flush(EMPTY_FACETS);
    await settle();

    expect(startSpy).toHaveBeenCalledTimes(1);
  });

  it('should_not_pause_when_pauseWhenHidden_is_disabled', async () => {
    await bootstrap({
      settings: { ...SETTINGS, pauseWhenHidden: false },
      projects: [PROJECT],
      status: IDLE_STATUS,
    });
    const stopSpy = vi.spyOn(TestBed.inject(SyncStore), 'stopPolling');

    setHidden(true);

    expect(stopSpy).not.toHaveBeenCalled();
  });

  it('should_not_pause_before_settings_have_loaded', async () => {
    fixture = TestBed.createComponent(BoardPageComponent);
    const stopSpy = vi.spyOn(TestBed.inject(SyncStore), 'stopPolling');
    fixture.detectChanges();
    await settle();

    setHidden(true);

    expect(stopSpy).not.toHaveBeenCalled();

    http.expectOne('/api/v1/settings').flush(SETTINGS);
    http.expectOne(CONNECTIONS_URL).flush(WITH_TOKEN_CONNECTIONS);
    http.expectOne('/api/v1/projects').flush([PROJECT]);
    http.expectOne(MERGE_REQUESTS_URL).flush({ mergeRequests: [], warnings: [] });
    http.expectOne(FACETS_URL).flush(EMPTY_FACETS);
    http.expectOne('/api/v1/sync/status').flush(IDLE_STATUS);
    await settle();
  });

  describe('tab title badge (RG-016-04)', () => {
    afterEach(() => {
      TestBed.inject(Title).setTitle('MR Board');
    });

    it('should_leave_the_default_title_when_tab_badge_is_disabled', async () => {
      await bootstrap({
        settings: { ...SETTINGS, tabBadge: false },
        projects: [PROJECT],
        status: IDLE_STATUS,
        mergeRequests: [mergeRequest({ readyLevel: 'red' })],
      });

      expect(TestBed.inject(Title).getTitle()).toBe('MR Board');
    });

    it('should_show_the_red_count_in_the_title_when_tab_badge_is_enabled', async () => {
      await bootstrap({
        settings: { ...SETTINGS, tabBadge: true },
        projects: [PROJECT],
        status: IDLE_STATUS,
        mergeRequests: [
          mergeRequest({ id: 1, readyLevel: 'red' }),
          mergeRequest({ id: 2, readyLevel: 'green' }),
          mergeRequest({ id: 3, readyLevel: 'red' }),
        ],
      });

      expect(TestBed.inject(Title).getTitle()).toBe('(2) MR Board');
    });

    it('should_use_the_default_title_when_no_merge_request_is_red', async () => {
      await bootstrap({
        settings: { ...SETTINGS, tabBadge: true },
        projects: [PROJECT],
        status: IDLE_STATUS,
        mergeRequests: [mergeRequest({ readyLevel: 'green' })],
      });

      expect(TestBed.inject(Title).getTitle()).toBe('MR Board');
    });

    it('should_restore_the_default_title_when_the_component_is_destroyed', async () => {
      await bootstrap({
        settings: { ...SETTINGS, tabBadge: true },
        projects: [PROJECT],
        status: IDLE_STATUS,
        mergeRequests: [mergeRequest({ readyLevel: 'red' })],
      });
      expect(TestBed.inject(Title).getTitle()).toBe('(1) MR Board');

      fixture.destroy();

      expect(TestBed.inject(Title).getTitle()).toBe('MR Board');
    });
  });
});
