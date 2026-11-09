import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '../core/api/api-error';
import { NotificationsService } from '../core/api/notifications.service';
import { HistoryEvent } from '../models/history.model';
import {
  NOTIFICATIONS_POLL_IDLE_MS,
  NOTIFICATIONS_POLL_RUNNING_MS,
  NotificationsStore,
} from './notifications.store';
import { SyncStore } from './sync.store';

function event(id: number): HistoryEvent {
  return {
    id,
    occurredAt: '2026-11-09T10:00:00.000Z',
    type: 'approved',
    status: 'confirmed',
    projectId: 1,
    projectAlias: 'api',
    mrIid: id,
    mrTitle: `MR ${id}`,
    mrWebUrl: `https://gitlab.com/mr/${id}`,
    actor: null,
    oldValue: null,
    newValue: null,
  };
}

describe('NotificationsStore', () => {
  const api = {
    getNotifications: vi.fn(),
    getSummary: vi.fn(),
    postDismiss: vi.fn(),
    postDismissAll: vi.fn(),
  };
  const running = signal(false);
  let store: InstanceType<typeof NotificationsStore>;

  const list = (ids: number[], count = ids.length, revision = 'r1') => ({
    events: ids.map(event),
    count,
    revision,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    running.set(false);
    TestBed.configureTestingModule({
      providers: [
        { provide: NotificationsService, useValue: api },
        { provide: SyncStore, useValue: { running } },
      ],
    });
    store = TestBed.inject(NotificationsStore);
  });

  afterEach(() => {
    store.stopPolling();
    vi.useRealTimers();
  });

  it('should_load_the_list_the_exact_count_and_the_revision', async () => {
    api.getNotifications.mockReturnValue(of(list([2, 1], 120)));

    await store.load();

    expect(store.events().map((e) => e.id)).toEqual([2, 1]);
    expect(store.count()).toBe(120);
    expect(store.revision()).toBe('r1');
    expect(store.loading()).toBe(false);
  });

  it('should_expose_an_error_key_when_the_load_fails', async () => {
    api.getNotifications.mockReturnValue(throwError(() => new ApiError(0, undefined, 'down')));

    await store.load();

    expect(store.error()).toBe('errors.network');
    expect(store.loading()).toBe(false);
  });

  describe('refresh (RG-040-05)', () => {
    it('should_load_the_list_when_the_revision_changed', async () => {
      api.getSummary.mockReturnValue(of({ count: 2, revision: 'r1' }));
      api.getNotifications.mockReturnValue(of(list([2, 1])));

      await store.refresh();

      expect(api.getNotifications).toHaveBeenCalledTimes(1);
      expect(store.count()).toBe(2);
    });

    it('should_not_reload_the_list_when_the_revision_is_unchanged', async () => {
      api.getNotifications.mockReturnValue(of(list([1])));
      await store.load();
      api.getSummary.mockReturnValue(of({ count: 1, revision: 'r1' }));

      await store.refresh();

      expect(api.getNotifications).toHaveBeenCalledTimes(1);
    });

    it('should_reload_when_a_provisional_event_is_confirmed_with_the_same_count', async () => {
      api.getNotifications.mockReturnValue(of(list([1], 1, '9:1:1')));
      await store.load();
      api.getSummary.mockReturnValue(of({ count: 1, revision: '9:1:0' }));
      api.getNotifications.mockReturnValue(of(list([1], 1, '9:1:0')));

      await store.refresh();

      expect(api.getNotifications).toHaveBeenCalledTimes(2);
      expect(store.revision()).toBe('9:1:0');
    });

    it('should_keep_the_current_state_and_flag_an_error_when_the_summary_fails', async () => {
      api.getNotifications.mockReturnValue(of(list([1])));
      await store.load();
      api.getSummary.mockReturnValue(throwError(() => new ApiError(0, undefined, 'down')));

      await store.refresh();

      expect(store.error()).toBe('errors.network');
      expect(store.events()).toHaveLength(1);
    });
  });

  describe('dismiss (RG-040-02/04)', () => {
    beforeEach(async () => {
      api.getNotifications.mockReturnValue(of(list([3, 2, 1], 8)));
      await store.load();
    });

    it('should_remove_the_entry_and_decrease_the_count_immediately', async () => {
      api.postDismiss.mockReturnValue(of(undefined));

      const error = await store.dismiss(2);

      expect(error).toBeNull();
      expect(store.events().map((e) => e.id)).toEqual([3, 1]);
      expect(store.count()).toBe(7);
      expect(api.postDismiss).toHaveBeenCalledWith(2);
    });

    it('should_restore_the_entry_and_the_count_when_the_call_fails', async () => {
      api.postDismiss.mockReturnValue(throwError(() => new ApiError(500, undefined, 'boom')));

      const error = await store.dismiss(2);

      expect(error).not.toBeNull();
      expect(store.events().map((e) => e.id)).toEqual([3, 2, 1]);
      expect(store.count()).toBe(8);
    });

    it('should_ignore_an_entry_that_is_not_listed', async () => {
      await expect(store.dismiss(99)).resolves.toBeNull();
      expect(api.postDismiss).not.toHaveBeenCalled();
    });
  });

  describe('dismissAll (RG-040-02)', () => {
    beforeEach(async () => {
      api.getNotifications.mockReturnValue(of(list([2, 1], 120)));
      await store.load();
    });

    it('should_empty_the_panel_and_reset_the_count', async () => {
      api.postDismissAll.mockReturnValue(of({ dismissed: 120 }));

      await expect(store.dismissAll()).resolves.toBeNull();

      expect(store.events()).toEqual([]);
      expect(store.count()).toBe(0);
    });

    it('should_restore_everything_when_the_call_fails', async () => {
      api.postDismissAll.mockReturnValue(throwError(() => new ApiError(500, undefined, 'boom')));

      await expect(store.dismissAll()).resolves.not.toBeNull();

      expect(store.events()).toHaveLength(2);
      expect(store.count()).toBe(120);
    });
  });

  describe('polling', () => {
    beforeEach(() => {
      api.getSummary.mockReturnValue(of({ count: 0, revision: 'r0' }));
      api.getNotifications.mockReturnValue(of(list([], 0, 'r0')));
    });

    it('should_refresh_immediately_then_every_60s_when_idle', async () => {
      store.startPolling();
      await vi.advanceTimersByTimeAsync(0);
      expect(api.getSummary).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(NOTIFICATIONS_POLL_IDLE_MS - 1);
      expect(api.getSummary).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(api.getSummary).toHaveBeenCalledTimes(2);
    });

    it('should_refresh_every_5s_during_a_synchronisation', async () => {
      running.set(true);
      store.startPolling();
      await vi.advanceTimersByTimeAsync(0);

      await vi.advanceTimersByTimeAsync(NOTIFICATIONS_POLL_RUNNING_MS);

      expect(api.getSummary).toHaveBeenCalledTimes(2);
    });

    it('should_stop_refreshing_once_stopped', async () => {
      store.startPolling();
      await vi.advanceTimersByTimeAsync(0);
      store.stopPolling();

      await vi.advanceTimersByTimeAsync(NOTIFICATIONS_POLL_IDLE_MS * 3);

      expect(api.getSummary).toHaveBeenCalledTimes(1);
    });
  });
});
