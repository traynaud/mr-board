import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideI18nTesting, t } from '../../core/i18n/testing';
import { HistoryEvent } from '../../models/history.model';
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
    load: vi.fn(),
    loadMore: vi.fn(),
  };
  const projects = {
    projects: signal<Project[]>([]),
    load: vi.fn(),
  };

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [HistoryPageComponent],
      providers: [
        provideRouter([]),
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
    state.load.mockReset();
    state.loadMore.mockReset();
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
});
