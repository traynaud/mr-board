import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { provideI18nTesting, t } from '../../core/i18n/testing';
import { apiBaseUrlInterceptor } from '../../core/interceptors/api-base-url.interceptor';
import { httpErrorInterceptor } from '../../core/interceptors/http-error.interceptor';
import { Project } from '../../models/project.model';
import { Settings } from '../../models/settings.model';
import { SyncRun, SyncStatus } from '../../models/sync-status.model';
import { provideIcons } from '../../shared/icons/provide-icons';
import { SyncStore } from '../../stores/sync.store';
import { BoardPageComponent } from './board-page.component';

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
const PROJECT: Project = {
  id: 1,
  pathWithNamespace: 'equipe/backend-api',
  alias: 'api',
  gitlabProjectId: 42,
};
const IDLE_STATUS: SyncStatus = { running: false, lastRun: null, nextRunAt: null };

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
  }): Promise<void> {
    fixture = TestBed.createComponent(BoardPageComponent);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await settle();
    http.expectOne('/api/v1/settings').flush(options.settings);
    http.expectOne('/api/v1/projects').flush(options.projects);
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

  it('should_show_the_empty_state_when_a_token_is_configured_but_no_repo_exists', async () => {
    await bootstrap({ settings: WITH_TOKEN_SETTINGS, projects: [], status: IDLE_STATUS });

    expect(el.querySelector('.no-token-banner')).toBeNull();
    expect(el.querySelector('.empty-state')).not.toBeNull();
    expect(el.querySelector('.empty-state p')?.textContent?.trim()).toBe(
      t('board.noRepos.title'),
    );
    expect(
      el.querySelector<HTMLButtonElement>('button[mat-stroked-button]')?.disabled,
    ).toBe(false);
  });

  it('should_show_the_placeholder_when_a_token_and_at_least_one_repo_exist', async () => {
    await bootstrap({ settings: WITH_TOKEN_SETTINGS, projects: [PROJECT], status: IDLE_STATUS });

    expect(el.querySelector('.no-token-banner')).toBeNull();
    expect(el.querySelector('.empty-state')).toBeNull();
    expect(el.querySelector('.placeholder')?.textContent?.trim()).toBe(t('board.placeholder'));
  });

  it('should_trigger_an_unscoped_sync_and_refresh_status_when_clicking_refresh', async () => {
    await bootstrap({ settings: WITH_TOKEN_SETTINGS, projects: [PROJECT], status: IDLE_STATUS });

    el.querySelector<HTMLButtonElement>('button[mat-stroked-button]')?.click();
    await settle();

    const syncReq = http.expectOne('/api/v1/sync');
    expect(syncReq.request.method).toBe('POST');
    syncReq.flush({ running: true }, { status: 202, statusText: 'Accepted' });
    await settle();
    http.expectOne('/api/v1/sync/status').flush({ running: true, lastRun: null, nextRunAt: null });
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

  it('should_toast_when_a_new_run_finishes_as_partial_or_error_while_the_page_is_open', async () => {
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

    expect(snackBar.open).toHaveBeenCalledTimes(1);
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
    http.expectOne('/api/v1/sync/status').flush(IDLE_STATUS);
    await settle();

    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(stopSpy).not.toHaveBeenCalled();

    fixture.destroy();
    expect(stopSpy).toHaveBeenCalledTimes(1);
  });
});
