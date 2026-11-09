import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '../core/api/api-error';
import { HistoryService } from '../core/api/history.service';
import { HistoryEvent } from '../models/history.model';
import { HistoryStore } from './history.store';

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

describe('HistoryStore', () => {
  const api = { getHistory: vi.fn() };
  let store: InstanceType<typeof HistoryStore>;

  beforeEach(() => {
    api.getHistory.mockReset();
    TestBed.configureTestingModule({ providers: [{ provide: HistoryService, useValue: api }] });
    store = TestBed.inject(HistoryStore);
  });

  it('should_load_first_page', async () => {
    api.getHistory.mockReturnValue(of({ events: [event(2), event(1)], nextCursor: 'c1', total: 3 }));
    await store.load();
    expect(api.getHistory).toHaveBeenCalledWith(null);
    expect(store.events().map((e) => e.id)).toEqual([2, 1]);
    expect(store.total()).toBe(3);
    expect(store.nextCursor()).toBe('c1');
    expect(store.loading()).toBe(false);
  });

  it('should_expose_error_key_when_load_fails', async () => {
    api.getHistory.mockReturnValue(throwError(() => new ApiError(0, undefined, 'down')));
    await store.load();
    expect(store.error()).toBe('errors.network');
    expect(store.loading()).toBe(false);
  });

  it('should_append_next_page_with_cursor', async () => {
    api.getHistory.mockReturnValueOnce(of({ events: [event(2)], nextCursor: 'c1', total: 2 }));
    await store.load();
    api.getHistory.mockReturnValueOnce(of({ events: [event(1)], nextCursor: null, total: 2 }));
    await store.loadMore();
    expect(api.getHistory).toHaveBeenLastCalledWith('c1');
    expect(store.events().map((e) => e.id)).toEqual([2, 1]);
    expect(store.nextCursor()).toBeNull();
  });

  it('should_do_nothing_on_load_more_without_cursor', async () => {
    api.getHistory.mockReturnValue(of({ events: [event(1)], nextCursor: null, total: 1 }));
    await store.load();
    api.getHistory.mockClear();
    await store.loadMore();
    expect(api.getHistory).not.toHaveBeenCalled();
  });

  it('should_keep_events_when_load_more_fails', async () => {
    api.getHistory.mockReturnValueOnce(of({ events: [event(2)], nextCursor: 'c1', total: 2 }));
    await store.load();
    api.getHistory.mockReturnValueOnce(throwError(() => new ApiError(500, undefined, 'boom')));
    await store.loadMore();
    expect(store.events()).toHaveLength(1);
    expect(store.error()).toBe('errors.unexpected');
    expect(store.nextCursor()).toBe('c1');
    expect(store.loadingMore()).toBe(false);
  });
});
