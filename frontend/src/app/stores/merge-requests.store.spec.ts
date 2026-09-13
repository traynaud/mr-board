import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '../core/api/api-error';
import { MergeRequestsService } from '../core/api/merge-requests.service';
import { SettingsService } from '../core/api/settings.service';
import { BrowserNotificationService } from '../core/notifications/browser-notification.service';
import { MergeRequestsFacets, MergeRequestView } from '../models/merge-request.model';
import { Settings } from '../models/settings.model';
import { FiltersStore } from './filters.store';
import { MergeRequestsStore } from './merge-requests.store';
import { SettingsStore } from './settings.store';

const MR: MergeRequestView = {
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
  mergeStatus: { state: 'mergeable', reasons: [] },
};
const RESPONSE = { mergeRequests: [MR], warnings: [] };
const EMPTY_COMPOSABLE_FILTERS = { project: [], author: [], assigned: [], approved: null, commented: null };
const EMPTY_FACETS: MergeRequestsFacets = {
  project: [{ value: 'api', label: 'api · equipe/api', count: 1 }],
  author: [{ value: 'mdupont', label: 'Marie Dupont', count: 1 }],
  assigned: [{ value: 'nobody', label: 'Nobody', count: 1 }],
  approved: [
    { value: 'yes', label: 'Oui', count: 0 },
    { value: 'no', label: 'Non', count: 1 },
  ],
  commented: [
    { value: 'yes', label: 'Oui', count: 0 },
    { value: 'no', label: 'Non', count: 1 },
  ],
};

const SETTINGS: Settings = {
  gitlabUrl: 'https://gitlab.com',
  tokenConfigured: false,
  tokenHint: null,
  meUsername: 'mdupont',
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
  notifyAssigned: true,
  tabBadge: false,
};

describe('MergeRequestsStore', () => {
  const api = { getMergeRequests: vi.fn(), getFacets: vi.fn() };
  const settingsApi = {
    getSettings: vi.fn(),
    putSettings: vi.fn(),
    postTestConnection: vi.fn(),
    getExportConfig: vi.fn(),
    postImportConfig: vi.fn(),
  };
  const notifications = { show: vi.fn(), isSupported: vi.fn(), permission: vi.fn(), requestPermission: vi.fn() };
  let store: InstanceType<typeof MergeRequestsStore>;
  let filters: InstanceType<typeof FiltersStore>;
  let settingsStore: InstanceType<typeof SettingsStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    api.getFacets.mockReturnValue(of(EMPTY_FACETS));
    TestBed.configureTestingModule({
      providers: [
        { provide: MergeRequestsService, useValue: api },
        { provide: SettingsService, useValue: settingsApi },
        { provide: BrowserNotificationService, useValue: notifications },
      ],
    });
    store = TestBed.inject(MergeRequestsStore);
    filters = TestBed.inject(FiltersStore);
    settingsStore = TestBed.inject(SettingsStore);
  });

  it('should_load_merge_requests', async () => {
    api.getMergeRequests.mockReturnValue(of(RESPONSE));

    const pending = store.load();
    expect(store.loading()).toBe(true);
    await pending;

    expect(store.loading()).toBe(false);
    expect(store.mergeRequests()).toEqual([MR]);
    expect(store.loadError()).toBeNull();
    expect(store.warnings()).toEqual([]);
  });

  it('should_expose_warnings_from_the_response', async () => {
    api.getMergeRequests.mockReturnValue(
      of({ mergeRequests: [], warnings: ['identity.missing'] }),
    );

    await store.load();

    expect(store.warnings()).toEqual(['identity.missing']);
  });

  it('should_expose_load_error_key_and_keep_loading_false', async () => {
    api.getMergeRequests.mockReturnValue(throwError(() => new ApiError(0, undefined, 'down')));

    await store.load();

    expect(store.loading()).toBe(false);
    expect(store.loadError()).toBe('errors.network');
  });

  it('should_not_clear_existing_merge_requests_when_a_reload_fails', async () => {
    api.getMergeRequests.mockReturnValueOnce(of(RESPONSE));
    await store.load();

    api.getMergeRequests.mockReturnValueOnce(
      throwError(() => new ApiError(500, undefined, 'boom')),
    );
    await store.load();

    expect(store.mergeRequests()).toEqual([MR]);
    expect(store.loadError()).toBe('errors.unexpected');
  });

  it('should_default_to_ready_ascending_and_pass_it_and_the_filters_to_the_api', async () => {
    api.getMergeRequests.mockReturnValue(of(RESPONSE));

    expect(store.sort()).toEqual({ key: 'ready', direction: 'asc' });
    await store.load();

    expect(api.getMergeRequests).toHaveBeenCalledWith(
      { key: 'ready', direction: 'asc' },
      { drafts: false, mine: false },
      EMPTY_COMPOSABLE_FILTERS,
    );
  });

  it('should_pass_the_current_filters_state_to_the_api', async () => {
    api.getMergeRequests.mockReturnValue(of(RESPONSE));
    filters.toggleDrafts();
    filters.toggleMine();

    await store.load();

    expect(api.getMergeRequests).toHaveBeenCalledWith(
      { key: 'ready', direction: 'asc' },
      { drafts: true, mine: true },
      EMPTY_COMPOSABLE_FILTERS,
    );
  });

  it('should_pass_the_composable_filters_to_the_api_and_facets_endpoint', async () => {
    api.getMergeRequests.mockReturnValue(of(RESPONSE));
    filters.addFilter('project');
    filters.toggleMultiValue('project', 'api');

    await store.load();

    const expectedComposableFilters = { ...EMPTY_COMPOSABLE_FILTERS, project: ['api'] };
    expect(api.getMergeRequests).toHaveBeenCalledWith(
      { key: 'ready', direction: 'asc' },
      { drafts: false, mine: false },
      expectedComposableFilters,
    );
    expect(api.getFacets).toHaveBeenCalledWith(
      { drafts: false, mine: false },
      expectedComposableFilters,
    );
  });

  it('should_expose_the_facets_from_the_response', async () => {
    api.getMergeRequests.mockReturnValue(of(RESPONSE));

    await store.load();

    expect(store.facets()).toEqual(EMPTY_FACETS);
  });

  it('should_silently_drop_a_selected_value_absent_from_the_new_facets_options', async () => {
    api.getMergeRequests.mockReturnValue(of(RESPONSE));
    filters.addFilter('author');
    filters.toggleMultiValue('author', 'ghost');
    api.getFacets.mockReturnValue(
      of({ ...EMPTY_FACETS, author: [{ value: 'mdupont', label: 'Marie Dupont', count: 1 }] }),
    );

    await store.load();

    expect(filters.author()).toEqual([]);
  });

  it('should_keep_a_selected_value_still_present_in_the_new_facets_options', async () => {
    api.getMergeRequests.mockReturnValue(of(RESPONSE));
    filters.addFilter('author');
    filters.toggleMultiValue('author', 'mdupont');
    api.getFacets.mockReturnValue(
      of({ ...EMPTY_FACETS, author: [{ value: 'mdupont', label: 'Marie Dupont', count: 1 }] }),
    );

    await store.load();

    expect(filters.author()).toEqual(['mdupont']);
  });

  it('should_switch_to_ascending_when_a_different_column_is_selected', async () => {
    api.getMergeRequests.mockReturnValue(of(RESPONSE));

    store.setSort('diff');
    await Promise.resolve();

    expect(store.sort()).toEqual({ key: 'diff', direction: 'asc' });
  });

  it('should_toggle_the_direction_when_the_same_column_is_selected_again', async () => {
    api.getMergeRequests.mockReturnValue(of(RESPONSE));

    store.setSort('ready'); // already 'ready', asc → desc
    await Promise.resolve();
    expect(store.sort()).toEqual({ key: 'ready', direction: 'desc' });

    store.setSort('ready'); // desc → asc
    await Promise.resolve();
    expect(store.sort()).toEqual({ key: 'ready', direction: 'asc' });
  });

  it('should_reload_the_merge_requests_when_the_sort_changes', () => {
    api.getMergeRequests.mockReturnValue(of(RESPONSE));
    api.getMergeRequests.mockClear();

    store.setSort('diff');

    expect(api.getMergeRequests).toHaveBeenCalledWith(
      { key: 'diff', direction: 'asc' },
      { drafts: false, mine: false },
      EMPTY_COMPOSABLE_FILTERS,
    );
  });

  describe('restoreSort', () => {
    it('should_patch_the_sort_directly_without_reloading', () => {
      api.getMergeRequests.mockReturnValue(of(RESPONSE));
      api.getMergeRequests.mockClear();

      store.restoreSort({ key: 'diff', direction: 'desc' });

      expect(store.sort()).toEqual({ key: 'diff', direction: 'desc' });
      expect(api.getMergeRequests).not.toHaveBeenCalled();
    });
  });

  describe('scheduleReload', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should_not_reload_immediately', () => {
      api.getMergeRequests.mockReturnValue(of(RESPONSE));

      store.scheduleReload();

      expect(api.getMergeRequests).not.toHaveBeenCalled();
    });

    it('should_reload_after_150ms', () => {
      api.getMergeRequests.mockReturnValue(of(RESPONSE));

      store.scheduleReload();
      vi.advanceTimersByTime(150);

      expect(api.getMergeRequests).toHaveBeenCalledTimes(1);
    });

    it('should_debounce_several_calls_into_a_single_reload', () => {
      api.getMergeRequests.mockReturnValue(of(RESPONSE));

      store.scheduleReload();
      vi.advanceTimersByTime(100);
      store.scheduleReload();
      vi.advanceTimersByTime(100);
      store.scheduleReload();
      vi.advanceTimersByTime(150);

      expect(api.getMergeRequests).toHaveBeenCalledTimes(1);
    });
  });

  describe('notifications', () => {
    async function loadSettings(settings: Settings): Promise<void> {
      settingsApi.getSettings.mockReturnValue(of(settings));
      await settingsStore.load();
    }

    const ASSIGNED_MR: MergeRequestView = {
      ...MR,
      reviewers: [{ username: 'mdupont', name: 'Marie Dupont', avatarUrl: null }],
    };

    it('should_not_notify_on_the_first_load_of_the_session', async () => {
      await loadSettings(SETTINGS);
      api.getMergeRequests.mockReturnValue(of({ mergeRequests: [ASSIGNED_MR], warnings: [] }));

      await store.load();

      expect(notifications.show).not.toHaveBeenCalled();
    });

    it('should_notify_a_new_assignment_on_a_subsequent_load_when_enabled', async () => {
      await loadSettings(SETTINGS);
      api.getMergeRequests.mockReturnValueOnce(of({ mergeRequests: [MR], warnings: [] }));
      await store.load();

      api.getMergeRequests.mockReturnValueOnce(
        of({ mergeRequests: [ASSIGNED_MR], warnings: [] }),
      );
      await store.load();

      expect(notifications.show).toHaveBeenCalledWith(
        `MR Board — ${ASSIGNED_MR.projectAlias} !${ASSIGNED_MR.iid}`,
        ASSIGNED_MR.title,
        expect.any(Function),
      );
    });

    it('should_not_notify_when_notify_assigned_is_disabled', async () => {
      await loadSettings({ ...SETTINGS, notifyAssigned: false });
      api.getMergeRequests.mockReturnValueOnce(of({ mergeRequests: [MR], warnings: [] }));
      await store.load();

      api.getMergeRequests.mockReturnValueOnce(
        of({ mergeRequests: [ASSIGNED_MR], warnings: [] }),
      );
      await store.load();

      expect(notifications.show).not.toHaveBeenCalled();
    });

    it('should_not_notify_when_settings_are_not_loaded', async () => {
      api.getMergeRequests.mockReturnValueOnce(of({ mergeRequests: [MR], warnings: [] }));
      await store.load();

      api.getMergeRequests.mockReturnValueOnce(
        of({ mergeRequests: [ASSIGNED_MR], warnings: [] }),
      );
      await store.load();

      expect(notifications.show).not.toHaveBeenCalled();
    });
  });
});
