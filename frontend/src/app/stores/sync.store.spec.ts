import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { SyncService } from '../core/api/sync.service';
import { SyncRun, SyncStatus } from '../models/sync-status.model';
import { POLL_IDLE_MS, POLL_RUNNING_MS, SyncStore } from './sync.store';

function status(overrides: Partial<SyncStatus> = {}): SyncStatus {
  return { running: false, lastRun: null, nextRunAt: null, ...overrides };
}

const LAST_RUN: SyncRun = {
  startedAt: '2026-09-11T08:00:00.000Z',
  finishedAt: '2026-09-11T08:00:05.000Z',
  status: 'success',
  mrCount: 3,
  errorMessage: null,
  trigger: 'manual',
};

describe('SyncStore', () => {
  const api = { postSync: vi.fn(), getStatus: vi.fn() };
  let store: InstanceType<typeof SyncStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [{ provide: SyncService, useValue: api }] });
    store = TestBed.inject(SyncStore);
  });

  afterEach(() => {
    store.stopPolling();
    vi.useRealTimers();
  });

  it('should_load_status', async () => {
    api.getStatus.mockReturnValue(of(status({ running: false, lastRun: LAST_RUN })));

    await store.loadStatus();

    expect(store.running()).toBe(false);
    expect(store.lastRun()).toEqual(LAST_RUN);
    expect(store.loading()).toBe(false);
  });

  it('should_report_loading_true_while_the_request_is_in_flight', async () => {
    api.getStatus.mockReturnValue(of(status()));

    const pending = store.loadStatus();
    expect(store.loading()).toBe(true);
    await pending;

    expect(store.loading()).toBe(false);
  });

  it('should_stop_loading_without_crashing_when_the_status_request_fails', async () => {
    api.getStatus.mockReturnValue(throwError(() => new Error('down')));

    await store.loadStatus();

    expect(store.loading()).toBe(false);
    expect(store.running()).toBe(false);
    expect(store.lastRun()).toBeNull();
  });

  it('should_post_sync_without_a_project_id_and_refresh_status_immediately', async () => {
    api.postSync.mockReturnValue(of({ running: true }));
    api.getStatus.mockReturnValue(of(status({ running: true })));

    await store.trigger();

    expect(api.postSync).toHaveBeenCalledWith(undefined);
    expect(api.getStatus).toHaveBeenCalled();
    expect(store.running()).toBe(true);
  });

  it('should_forward_the_project_id_to_a_targeted_trigger', async () => {
    api.postSync.mockReturnValue(of({ running: true }));
    api.getStatus.mockReturnValue(of(status({ running: true })));

    await store.trigger(7);

    expect(api.postSync).toHaveBeenCalledWith(7);
  });

  it('should_still_refresh_status_when_the_trigger_request_fails', async () => {
    api.postSync.mockReturnValue(throwError(() => new Error('boom')));
    api.getStatus.mockReturnValue(of(status()));

    await store.trigger();

    expect(api.getStatus).toHaveBeenCalled();
  });

  it('should_poll_every_5s_while_running_and_every_60s_otherwise', async () => {
    vi.useFakeTimers();
    api.getStatus
      .mockReturnValueOnce(of(status({ running: true })))
      .mockReturnValueOnce(of(status({ running: false })))
      .mockReturnValue(of(status({ running: false })));

    store.startPolling();
    await vi.advanceTimersByTimeAsync(0);
    expect(api.getStatus).toHaveBeenCalledTimes(1);
    expect(store.running()).toBe(true);

    await vi.advanceTimersByTimeAsync(POLL_RUNNING_MS);
    expect(api.getStatus).toHaveBeenCalledTimes(2);
    expect(store.running()).toBe(false);

    await vi.advanceTimersByTimeAsync(POLL_IDLE_MS);
    expect(api.getStatus).toHaveBeenCalledTimes(3);
  });

  it('should_stop_polling_and_never_call_status_again', async () => {
    vi.useFakeTimers();
    api.getStatus.mockReturnValue(of(status()));

    store.startPolling();
    await vi.advanceTimersByTimeAsync(0);
    expect(api.getStatus).toHaveBeenCalledTimes(1);

    store.stopPolling();
    await vi.advanceTimersByTimeAsync(POLL_IDLE_MS * 2);
    expect(api.getStatus).toHaveBeenCalledTimes(1);
  });

  it('should_not_resume_polling_when_stopped_while_the_initial_load_was_still_pending', async () => {
    vi.useFakeTimers();
    api.getStatus.mockReturnValueOnce(of(status()).pipe(delay(1000)));

    store.startPolling();
    store.stopPolling();
    await vi.advanceTimersByTimeAsync(1000);
    expect(api.getStatus).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(POLL_IDLE_MS * 2);
    expect(api.getStatus).toHaveBeenCalledTimes(1);
  });
});
