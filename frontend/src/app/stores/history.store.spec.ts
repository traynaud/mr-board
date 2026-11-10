import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { ApiError } from '../core/api/api-error';
import { HistoryService } from '../core/api/history.service';
import { EMPTY_HISTORY_FILTERS, HistoryEvent, HistoryResponse } from '../models/history.model';
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
  const api = { getHistory: vi.fn(), getActors: vi.fn() };
  let store: InstanceType<typeof HistoryStore>;

  beforeEach(() => {
    api.getHistory.mockReset();
    api.getActors.mockReset();
    TestBed.configureTestingModule({ providers: [{ provide: HistoryService, useValue: api }] });
    store = TestBed.inject(HistoryStore);
  });

  it('should_load_first_page', async () => {
    api.getHistory.mockReturnValue(of({ events: [event(2), event(1)], nextCursor: 'c1', total: 3 }));
    await store.load();
    expect(api.getHistory).toHaveBeenCalledWith(null, undefined, EMPTY_HISTORY_FILTERS);
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
    expect(api.getHistory).toHaveBeenLastCalledWith('c1', undefined, EMPTY_HISTORY_FILTERS);
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

  describe('filters (US-038)', () => {
    const page = (ids: number[], nextCursor: string | null = null, total = ids.length) =>
      of({ events: ids.map(event), nextCursor, total });

    it('should_reload_from_the_first_page_with_the_new_filter', async () => {
      api.getHistory.mockReturnValue(page([2, 1], 'c1', 10));
      await store.load();
      api.getHistory.mockReturnValue(page([7], null, 1));
      await store.toggleType('merged');
      expect(api.getHistory).toHaveBeenLastCalledWith(null, undefined, {
        ...EMPTY_HISTORY_FILTERS,
        types: ['merged'],
      });
      expect(store.events().map((e) => e.id)).toEqual([7]);
      expect(store.total()).toBe(1);
      expect(store.nextCursor()).toBeNull();
    });

    it('should_toggle_types_actors_and_projects_on_and_off', async () => {
      api.getHistory.mockReturnValue(page([]));
      await store.toggleType('merged');
      await store.toggleType('closed');
      await store.toggleType('merged');
      await store.toggleActor('alice');
      await store.toggleActor('none');
      await store.toggleActor('alice');
      await store.toggleProject(3);
      expect(store.filters()).toMatchObject({ types: ['closed'], actors: ['none'], projects: [3] });
    });

    it('should_set_search_and_period', async () => {
      api.getHistory.mockReturnValue(page([]));
      await store.setSearch('login');
      await store.setPeriod('2026-11-06', null);
      expect(store.filters()).toMatchObject({ search: 'login', from: '2026-11-06', to: null });
    });

    it('should_keep_the_filters_when_loading_more', async () => {
      api.getHistory.mockReturnValue(page([2], 'c1', 3));
      await store.toggleType('merged');
      api.getHistory.mockReturnValue(page([1], null, 3));
      await store.loadMore();
      expect(api.getHistory).toHaveBeenLastCalledWith('c1', undefined, {
        ...EMPTY_HISTORY_FILTERS,
        types: ['merged'],
      });
    });

    it('should_ignore_a_late_response_of_a_previous_filter', async () => {
      const slow = new Subject<HistoryResponse>();
      api.getHistory.mockReturnValueOnce(slow);
      const first = store.setSearch('old');
      api.getHistory.mockReturnValueOnce(page([9], null, 1));
      await store.setSearch('new');
      slow.next({ events: [event(1)], nextCursor: 'stale', total: 99 });
      slow.complete();
      await first;
      expect(store.events().map((e) => e.id)).toEqual([9]);
      expect(store.total()).toBe(1);
      expect(store.nextCursor()).toBeNull();
      expect(store.loading()).toBe(false);
    });

    it('should_drop_a_load_more_answer_when_the_filters_changed_meanwhile', async () => {
      api.getHistory.mockReturnValue(page([2], 'c1', 3));
      await store.load();
      const slow = new Subject<HistoryResponse>();
      api.getHistory.mockReturnValueOnce(slow);
      const more = store.loadMore();
      api.getHistory.mockReturnValueOnce(page([8], null, 1));
      await store.setSearch('x');
      slow.next({ events: [event(1)], nextCursor: null, total: 3 });
      slow.complete();
      await more;
      expect(store.events().map((e) => e.id)).toEqual([8]);
      expect(store.loadingMore()).toBe(false);
    });

    it('should_clear_the_list_when_a_filtered_load_fails', async () => {
      api.getHistory.mockReturnValue(page([1], null, 1));
      await store.load();
      api.getHistory.mockReturnValue(throwError(() => new ApiError(0, undefined, 'down')));
      await store.toggleType('merged');
      expect(store.events()).toEqual([]);
      expect(store.error()).toBe('errors.network');
    });

    it('should_show_a_pill_without_value_and_not_reload', async () => {
      api.getHistory.mockReturnValue(page([]));
      await store.load();
      api.getHistory.mockClear();
      store.addFilter('actor');
      store.addFilter('actor');
      expect(store.activeKeys()).toEqual(['actor']);
      expect(api.getHistory).not.toHaveBeenCalled();
    });

    it('should_remove_a_pill_with_its_values_and_reload', async () => {
      api.getHistory.mockReturnValue(page([]));
      await store.toggleType('merged');
      store.addFilter('type');
      await store.setPeriod('2026-11-01', '2026-11-03');
      store.addFilter('period');
      await store.removeFilter('period');
      expect(store.filters()).toMatchObject({ types: ['merged'], from: null, to: null });
      expect(store.activeKeys()).toEqual(['type']);
      await store.removeFilter('type');
      expect(store.filters().types).toEqual([]);
      expect(api.getHistory).toHaveBeenLastCalledWith(null, undefined, EMPTY_HISTORY_FILTERS);
    });

    it('should_clear_every_filter_including_the_search', async () => {
      api.getHistory.mockReturnValue(page([]));
      await store.setSearch('x');
      await store.toggleActor('alice');
      store.addFilter('actor');
      await store.clearFilters();
      expect(store.filters()).toEqual(EMPTY_HISTORY_FILTERS);
      expect(store.activeKeys()).toEqual([]);
    });

    it('should_restore_filters_without_loading_and_derive_the_pills', () => {
      store.restoreFilters({ ...EMPTY_HISTORY_FILTERS, types: ['merged'], to: '2026-11-03' });
      expect(store.activeKeys()).toEqual(['type', 'period']);
      expect(api.getHistory).not.toHaveBeenCalled();
    });

    it('should_load_the_actor_options_and_tolerate_an_error', async () => {
      const actors = [{ username: 'alice', name: 'Alice', avatarUrl: null }];
      api.getActors.mockReturnValueOnce(of(actors));
      await store.loadActors();
      expect(store.actorOptions()).toEqual(actors);
      api.getActors.mockReturnValueOnce(throwError(() => new ApiError(500, undefined, 'boom')));
      await store.loadActors();
      expect(store.actorOptions()).toEqual([]);
    });
  });
});
