import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '../core/api/api-error';
import { ConnectionsService } from '../core/api/connections.service';
import { MergeRequestsService } from '../core/api/merge-requests.service';
import { SettingsService } from '../core/api/settings.service';
import { BrowserNotificationService } from '../core/notifications/browser-notification.service';
import { MergeRequestsFacets, MergeRequestView } from '../models/merge-request.model';
import { Settings } from '../models/settings.model';
import { ConnectionsStore } from './connections.store';
import { FiltersStore } from './filters.store';
import { MergeRequestsStore } from './merge-requests.store';
import { SettingsStore } from './settings.store';

const CONNECTION = { id: 1, name: 'GitLab', type: 'gitlab' as const };

const MR: MergeRequestView = {
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
  connection: CONNECTION,
};
const RESPONSE = { mergeRequests: [MR], warnings: [] };
const EMPTY_COMPOSABLE_FILTERS = {
  connection: [],
  project: [],
  author: [],
  assigned: [],
  approved: null,
  commented: null,
  label: [],
};
const EMPTY_FACETS: MergeRequestsFacets = {
  connection: [{ value: 'GitLab', label: 'GitLab', count: 1 }],
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
  label: [{ value: 'none', label: 'Sans label', count: 1 }],
};

const SETTINGS: Settings = {
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
  theme: 'system',
  highlightMe: true,
  language: 'fr',
};

describe('MergeRequestsStore', () => {
  const api = { getMergeRequests: vi.fn(), getFacets: vi.fn(), setFavorite: vi.fn() };
  const settingsApi = {
    getSettings: vi.fn(),
    putSettings: vi.fn(),
    getExportConfig: vi.fn(),
    postImportConfig: vi.fn(),
  };
  const notifications = { show: vi.fn(), isSupported: vi.fn(), permission: vi.fn(), requestPermission: vi.fn() };
  const connectionsApi = { getConnections: vi.fn() };
  let store: InstanceType<typeof MergeRequestsStore>;
  let filters: InstanceType<typeof FiltersStore>;
  let settingsStore: InstanceType<typeof SettingsStore>;
  let connectionsStore: InstanceType<typeof ConnectionsStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    api.getFacets.mockReturnValue(of(EMPTY_FACETS));
    connectionsApi.getConnections.mockReturnValue(of([]));
    TestBed.configureTestingModule({
      providers: [
        { provide: MergeRequestsService, useValue: api },
        { provide: SettingsService, useValue: settingsApi },
        { provide: ConnectionsService, useValue: connectionsApi },
        { provide: BrowserNotificationService, useValue: notifications },
      ],
    });
    store = TestBed.inject(MergeRequestsStore);
    filters = TestBed.inject(FiltersStore);
    settingsStore = TestBed.inject(SettingsStore);
    connectionsStore = TestBed.inject(ConnectionsStore);
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
      { drafts: false, mine: false, favorites: false, search: '' },
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
      { drafts: true, mine: true, favorites: false, search: '' },
      EMPTY_COMPOSABLE_FILTERS,
    );
  });

  it('should_pass_the_current_search_to_the_api_rg_026', async () => {
    api.getMergeRequests.mockReturnValue(of(RESPONSE));
    filters.setSearch('facturation');

    await store.load();

    expect(api.getMergeRequests).toHaveBeenCalledWith(
      { key: 'ready', direction: 'asc' },
      { drafts: false, mine: false, favorites: false, search: 'facturation' },
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
      { drafts: false, mine: false, favorites: false, search: '' },
      expectedComposableFilters,
    );
    expect(api.getFacets).toHaveBeenCalledWith(
      { drafts: false, mine: false, favorites: false, search: '' },
      expectedComposableFilters,
    );
  });

  it('should_pass_the_connection_composable_filter_to_the_api_and_facets_endpoint_rg_021_03', async () => {
    api.getMergeRequests.mockReturnValue(of(RESPONSE));
    filters.addFilter('connection');
    filters.toggleMultiValue('connection', 'gitlab.com');

    await store.load();

    const expectedComposableFilters = { ...EMPTY_COMPOSABLE_FILTERS, connection: ['gitlab.com'] };
    expect(api.getMergeRequests).toHaveBeenCalledWith(
      { key: 'ready', direction: 'asc' },
      { drafts: false, mine: false, favorites: false, search: '' },
      expectedComposableFilters,
    );
    expect(api.getFacets).toHaveBeenCalledWith(
      { drafts: false, mine: false, favorites: false, search: '' },
      expectedComposableFilters,
    );
  });

  it('should_silently_drop_a_selected_connection_absent_from_the_new_facets_options_rg_021_03', async () => {
    api.getMergeRequests.mockReturnValue(of(RESPONSE));
    filters.addFilter('connection');
    filters.toggleMultiValue('connection', 'ghost.example.com');

    await store.load();

    expect(filters.connection()).toEqual([]);
  });

  it('should_keep_a_selected_connection_matching_case_insensitively_rg_021_05', async () => {
    // EMPTY_FACETS.connection contient « GitLab » ; une sélection restaurée
    // depuis l'URL dans une autre casse ne doit pas être purgée à tort, le
    // backend la matchant lui aussi de façon insensible à la casse.
    api.getMergeRequests.mockReturnValue(of(RESPONSE));
    filters.addFilter('connection');
    filters.toggleMultiValue('connection', 'gitlab');

    await store.load();

    expect(filters.connection()).toEqual(['gitlab']);
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
      { drafts: false, mine: false, favorites: false, search: '' },
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

    it('should_accept_a_custom_debounce_for_the_search_field_rg_026_09', () => {
      api.getMergeRequests.mockReturnValue(of(RESPONSE));

      store.scheduleReload(300);
      vi.advanceTimersByTime(150);
      expect(api.getMergeRequests).not.toHaveBeenCalled();

      vi.advanceTimersByTime(150);
      expect(api.getMergeRequests).toHaveBeenCalledTimes(1);
    });

    it('should_reload_immediately_with_a_debounce_of_0', () => {
      api.getMergeRequests.mockReturnValue(of(RESPONSE));

      store.scheduleReload(0);
      vi.advanceTimersByTime(0);

      expect(api.getMergeRequests).toHaveBeenCalledTimes(1);
    });
  });

  describe('toggleFavorite', () => {
    it('should_optimistically_flip_is_favorite_before_the_api_resolves_rg_027_09', async () => {
      api.getMergeRequests.mockReturnValue(of(RESPONSE));
      await store.load();
      api.setFavorite.mockReturnValue(of(undefined));

      const pending = store.toggleFavorite(MR);
      expect(store.mergeRequests()[0].isFavorite).toBe(true);
      await pending;

      expect(store.mergeRequests()[0].isFavorite).toBe(true);
      expect(api.setFavorite).toHaveBeenCalledWith(1, true);
    });

    it('should_unmark_when_the_row_is_already_a_favorite', async () => {
      api.getMergeRequests.mockReturnValue(of({ mergeRequests: [{ ...MR, isFavorite: true }], warnings: [] }));
      await store.load();
      api.setFavorite.mockReturnValue(of(undefined));

      await store.toggleFavorite(store.mergeRequests()[0]);

      expect(store.mergeRequests()[0].isFavorite).toBe(false);
      expect(api.setFavorite).toHaveBeenCalledWith(1, false);
    });

    it('should_roll_back_and_return_an_error_key_when_the_api_call_fails_rg_027_09', async () => {
      api.getMergeRequests.mockReturnValue(of(RESPONSE));
      await store.load();
      api.setFavorite.mockReturnValue(throwError(() => new ApiError(500, undefined, 'boom')));

      const errorKey = await store.toggleFavorite(MR);

      expect(errorKey).toBe('errors.unexpected');
      expect(store.mergeRequests()[0].isFavorite).toBe(false);
    });

    it('should_not_affect_other_rows', async () => {
      const OTHER: MergeRequestView = { ...MR, id: 2, iid: 8 };
      api.getMergeRequests.mockReturnValue(
        of({ mergeRequests: [MR, OTHER], warnings: [] }),
      );
      await store.load();
      api.setFavorite.mockReturnValue(of(undefined));

      await store.toggleFavorite(MR);

      expect(store.mergeRequests().find((mr) => mr.id === 2)?.isFavorite).toBe(false);
    });
  });

  describe('notifications', () => {
    async function loadSettings(settings: Settings): Promise<void> {
      settingsApi.getSettings.mockReturnValue(of(settings));
      await settingsStore.load();
    }

    const ASSIGNED_MR: MergeRequestView = {
      ...MR,
      reviewers: [{ username: 'mdupont', name: 'Marie Dupont', avatarUrl: null, isMe: true }],
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

    it('should_name_the_connection_in_the_body_when_at_least_two_are_configured_rg_021_08', async () => {
      connectionsApi.getConnections.mockReturnValue(
        of([
          { id: 1, type: 'gitlab', name: 'GitLab', url: 'https://gitlab.com', tokenConfigured: true, tokenHint: null, identity: null, projectsCount: 1 },
          { id: 2, type: 'github', name: 'GitHub', url: 'https://github.com', tokenConfigured: true, tokenHint: null, identity: null, projectsCount: 1 },
        ]),
      );
      await connectionsStore.load();
      await loadSettings(SETTINGS);
      api.getMergeRequests.mockReturnValueOnce(of({ mergeRequests: [MR], warnings: [] }));
      await store.load();

      api.getMergeRequests.mockReturnValueOnce(
        of({ mergeRequests: [ASSIGNED_MR], warnings: [] }),
      );
      await store.load();

      expect(notifications.show).toHaveBeenCalledWith(
        `MR Board — ${ASSIGNED_MR.projectAlias} !${ASSIGNED_MR.iid}`,
        `[${ASSIGNED_MR.connection.name} · ${ASSIGNED_MR.projectAlias}] ${ASSIGNED_MR.title}`,
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
