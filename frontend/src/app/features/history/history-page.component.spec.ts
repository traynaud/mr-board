import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { provideI18nTesting, t } from '../../core/i18n/testing';
import {
  EMPTY_HISTORY_FILTERS,
  HistoryActorOption,
  HistoryEvent,
  HistoryFilterKey,
  HistoryFilters,
} from '../../models/history.model';
import { Project } from '../../models/project.model';
import { provideIcons } from '../../shared/icons/provide-icons';
import { HistoryStore } from '../../stores/history.store';
import { ProjectsStore } from '../../stores/projects.store';
import { HistoryPageComponent } from './history-page.component';

function event(id: number, occurredAt: string, projectId = 1): HistoryEvent {
  return {
    id,
    occurredAt,
    type: 'approved',
    status: 'confirmed',
    projectId,
    projectAlias: 'api',
    mrIid: id,
    mrTitle: `MR ${id}`,
    mrWebUrl: `https://gitlab.com/mr/${id}`,
    actor: { username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
    oldValue: null,
    newValue: null,
  };
}

describe('HistoryPageComponent', () => {
  const state = {
    events: signal<HistoryEvent[]>([]),
    total: signal(0),
    nextCursor: signal<string | null>(null),
    loading: signal(false),
    loadingMore: signal(false),
    error: signal<string | null>(null),
    filters: signal<HistoryFilters>(EMPTY_HISTORY_FILTERS),
    activeKeys: signal<HistoryFilterKey[]>([]),
    actorOptions: signal<HistoryActorOption[]>([]),
    load: vi.fn(),
    loadMore: vi.fn(),
    loadActors: vi.fn(),
    restoreFilters: vi.fn(),
    setSearch: vi.fn(),
    toggleType: vi.fn(),
    toggleActor: vi.fn(),
    toggleProject: vi.fn(),
    setPeriod: vi.fn(),
    addFilter: vi.fn(),
    removeFilter: vi.fn(),
    clearFilters: vi.fn(),
  };
  const projects = {
    projects: signal<Project[]>([]),
    load: vi.fn(),
  };

  async function setup(queryParams: Record<string, string> = {}) {
    await TestBed.configureTestingModule({
      imports: [HistoryPageComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParams } } },
        provideI18nTesting(),
        provideIcons(),
        { provide: HistoryStore, useValue: state },
        { provide: ProjectsStore, useValue: projects },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(HistoryPageComponent);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    state.events.set([]);
    state.total.set(0);
    state.nextCursor.set(null);
    state.loading.set(false);
    state.loadingMore.set(false);
    state.error.set(null);
    state.filters.set(EMPTY_HISTORY_FILTERS);
    state.activeKeys.set([]);
    state.actorOptions.set([]);
    for (const fn of [
      state.load,
      state.loadMore,
      state.loadActors,
      state.restoreFilters,
      state.setSearch,
      state.toggleType,
      state.toggleActor,
      state.toggleProject,
      state.setPeriod,
      state.addFilter,
      state.removeFilter,
      state.clearFilters,
    ]) {
      fn.mockReset();
    }
    projects.projects.set([]);
    projects.load.mockReset();
    TestBed.resetTestingModule();
  });

  it('should_load_history_and_projects_on_init', async () => {
    await setup();
    expect(state.load).toHaveBeenCalledOnce();
    expect(projects.load).toHaveBeenCalledOnce();
  });

  it('should_show_the_empty_state', async () => {
    const { el } = await setup();
    expect(el.querySelector('.empty')?.textContent).toContain(t('history.empty'));
  });

  it('should_show_the_loading_bar', async () => {
    state.loading.set(true);
    const { el } = await setup();
    expect(el.querySelector('mat-progress-bar')).not.toBeNull();
  });

  it('should_show_the_error_with_a_retry_that_reloads', async () => {
    state.error.set('errors.network');
    const { fixture, el } = await setup();
    expect(el.querySelector('.error')?.textContent).toContain(t('history.error'));
    state.load.mockClear();
    el.querySelector<HTMLButtonElement>('.error button')!.click();
    await fixture.whenStable();
    expect(state.load).toHaveBeenCalledOnce();
  });

  it('should_group_events_by_day_with_today_and_yesterday_labels', async () => {
    const now = Date.now();
    state.events.set([
      event(3, new Date(now).toISOString()),
      event(2, new Date(now - 86_400_000).toISOString()),
      event(1, new Date(now - 10 * 86_400_000).toISOString()),
    ]);
    state.total.set(3);
    const { el } = await setup();
    const titles = Array.from(el.querySelectorAll('.day-title')).map((n) => n.textContent?.trim());
    expect(titles[0]).toBe(t('history.today'));
    expect(titles[1]).toBe(t('history.yesterday'));
    expect(titles).toHaveLength(3);
    expect(el.querySelectorAll('app-history-event-row')).toHaveLength(3);
  });

  it('should_show_load_more_only_with_a_next_cursor_and_load_the_next_page', async () => {
    state.events.set([event(1, new Date().toISOString())]);
    state.nextCursor.set('c1');
    const { fixture, el } = await setup();
    const button = el.querySelector<HTMLButtonElement>('.load-more button')!;
    expect(button.textContent).toContain(t('history.loadMore'));
    button.click();
    expect(state.loadMore).toHaveBeenCalledOnce();

    state.nextCursor.set(null);
    await fixture.whenStable();
    expect(el.querySelector('.load-more')).toBeNull();
  });

  it('should_disable_load_more_while_loading_the_next_page', async () => {
    state.events.set([event(1, new Date().toISOString())]);
    state.nextCursor.set('c1');
    state.loadingMore.set(true);
    const { el } = await setup();
    expect(el.querySelector<HTMLButtonElement>('.load-more button')!.disabled).toBe(true);
  });

  it('should_show_the_event_count', async () => {
    state.events.set([event(1, new Date().toISOString())]);
    state.total.set(42);
    const { el } = await setup();
    expect(el.querySelector('.count')?.textContent).toContain('42');
  });

  describe('filters (US-038)', () => {
    it('should_restore_filters_from_the_url_before_loading', async () => {
      await setup({ type: 'merged,inconnu', actor: 'alice', project: '3', q: 'login', from: '2026-11-01' });
      expect(state.restoreFilters).toHaveBeenCalledWith({
        search: 'login',
        types: ['merged'],
        actors: ['alice'],
        projects: [3],
        from: '2026-11-01',
        to: null,
      });
      expect(state.restoreFilters.mock.invocationCallOrder[0]).toBeLessThan(
        state.load.mock.invocationCallOrder[0],
      );
      expect(state.loadActors).toHaveBeenCalledOnce();
    });

    it('should_reflect_filters_in_the_url_and_drop_empty_ones', async () => {
      const { fixture } = await setup();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      state.filters.set({ ...EMPTY_HISTORY_FILTERS, types: ['merged', 'closed'], from: '2026-11-06' });
      fixture.detectChanges();
      await fixture.whenStable();
      const call = navigate.mock.calls.at(-1)!;
      expect(call[1]).toMatchObject({
        queryParams: {
          q: null,
          type: 'merged,closed',
          actor: null,
          project: null,
          from: '2026-11-06',
          to: null,
        },
        replaceUrl: true,
        queryParamsHandling: 'merge',
      });
    });

    it('should_show_the_no_match_state_with_a_clear_button_when_filters_are_active', async () => {
      state.filters.set({ ...EMPTY_HISTORY_FILTERS, search: 'zzz' });
      const { fixture, el } = await setup();
      expect(el.querySelector('.empty')?.textContent).toContain(t('history.filters.noMatch'));
      expect(el.querySelector('.empty')?.textContent).not.toContain(t('history.empty'));
      el.querySelector<HTMLButtonElement>('.empty button')!.click();
      await fixture.whenStable();
      expect(state.clearFilters).toHaveBeenCalledOnce();
    });

    it('should_offer_to_clear_filters_in_the_error_state_only_when_filters_are_active', async () => {
      state.error.set('errors.network');
      const first = await setup();
      expect(first.el.querySelectorAll('.error button')).toHaveLength(1);
      TestBed.resetTestingModule();
      state.filters.set({ ...EMPTY_HISTORY_FILTERS, types: ['merged'] });
      const second = await setup();
      expect(second.el.querySelectorAll('.error button')).toHaveLength(2);
    });

    it('should_keep_the_list_dimmed_under_the_loading_bar_while_filters_reload', async () => {
      state.events.set([event(1, new Date().toISOString())]);
      state.loading.set(true);
      const { el } = await setup();
      expect(el.querySelector('mat-progress-bar')).not.toBeNull();
      expect(el.querySelector('.timeline.reloading')).not.toBeNull();
      expect(el.querySelectorAll('app-history-event-row')).toHaveLength(1);
    });

    it('should_show_clear_in_the_bar_only_with_an_active_filter', async () => {
      const first = await setup();
      expect(first.el.querySelector('app-history-filter-bar .clear')).toBeNull();
      TestBed.resetTestingModule();
      state.filters.set({ ...EMPTY_HISTORY_FILTERS, projects: [1] });
      state.activeKeys.set(['project']);
      const second = await setup();
      second.el.querySelector<HTMLButtonElement>('app-history-filter-bar .clear')!.click();
      expect(state.clearFilters).toHaveBeenCalledOnce();
    });
  });
});
