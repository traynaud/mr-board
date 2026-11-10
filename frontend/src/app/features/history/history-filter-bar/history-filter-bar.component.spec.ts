import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatMenuHarness } from '@angular/material/menu/testing';
import { provideI18nTesting, t } from '../../../core/i18n/testing';
import {
  EMPTY_HISTORY_FILTERS,
  HistoryActorOption,
  HistoryFilterKey,
  HistoryFilters,
} from '../../../models/history.model';
import { Project } from '../../../models/project.model';
import { provideIcons } from '../../../shared/icons/provide-icons';
import { HISTORY_SEARCH_DEBOUNCE_MS, HistoryFilterBarComponent } from './history-filter-bar.component';

const ACTORS: HistoryActorOption[] = [
  { username: 'alice', name: 'Alice Martin', avatarUrl: null },
  { username: 'ghost', name: null, avatarUrl: null },
];
const PROJECTS: Project[] = [
  { id: 1, connectionId: 1, pathWithNamespace: 'equipe/api', alias: 'api', remoteProjectId: '1', color: 'slate' },
  { id: 2, connectionId: 1, pathWithNamespace: 'equipe/web', alias: 'web', remoteProjectId: '2', color: null },
];

@Component({
  imports: [HistoryFilterBarComponent],
  template: `
    <app-history-filter-bar
      [filters]="filters()"
      [activeKeys]="activeKeys()"
      [actors]="actors"
      [projects]="projects()"
      [hasFilter]="hasFilter()"
      (searchChange)="events.push(['search', $event])"
      (toggleType)="events.push(['type', $event])"
      (toggleActor)="events.push(['actor', $event])"
      (toggleProject)="events.push(['project', $event])"
      (periodChange)="events.push(['period', $event])"
      (filterAdd)="events.push(['add', $event])"
      (filterRemove)="events.push(['remove', $event])"
      (clearFilters)="events.push(['clear', null])"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly filters = signal<HistoryFilters>(EMPTY_HISTORY_FILTERS);
  readonly activeKeys = signal<HistoryFilterKey[]>([]);
  readonly projects = signal<Project[]>(PROJECTS);
  readonly hasFilter = signal(false);
  readonly actors = ACTORS;
  events: [string, unknown][] = [];
}

describe('HistoryFilterBarComponent', () => {
  async function setup() {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideI18nTesting(), provideIcons()],
    }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    return {
      fixture,
      host: fixture.componentInstance,
      el: fixture.nativeElement as HTMLElement,
      loader: TestbedHarnessEnvironment.loader(fixture),
    };
  }

  afterEach(() => vi.useRealTimers());

  const searchInput = (el: HTMLElement) => el.querySelector<HTMLInputElement>('input[type="search"]')!;
  const type = (el: HTMLElement, value: string) => {
    const input = searchInput(el);
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };

  it('should_show_the_search_field_but_no_pill_nor_clear_by_default', async () => {
    const { el } = await setup();
    expect(searchInput(el).placeholder).toBe(t('history.filters.searchPlaceholder'));
    expect(searchInput(el).maxLength).toBe(100);
    expect(el.querySelector('app-history-filter-pill, app-history-period-pill')).toBeNull();
    expect(el.querySelector('.clear')).toBeNull();
  });

  it('should_debounce_the_search_by_300ms_and_emit_the_last_value_only', async () => {
    const { fixture, host, el } = await setup();
    vi.useFakeTimers();
    type(el, 're');
    vi.advanceTimersByTime(HISTORY_SEARCH_DEBOUNCE_MS - 1);
    type(el, 'refacto');
    vi.advanceTimersByTime(HISTORY_SEARCH_DEBOUNCE_MS - 1);
    expect(host.events).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(host.events).toEqual([['search', 'refacto']]);
    await fixture.whenStable();
  });

  it('should_resynchronise_the_field_when_the_search_is_cleared_from_outside', async () => {
    const { fixture, host, el } = await setup();
    host.filters.set({ ...EMPTY_HISTORY_FILTERS, search: 'login' });
    await fixture.whenStable();
    expect(searchInput(el).value).toBe('login');
    host.filters.set(EMPTY_HISTORY_FILTERS);
    await fixture.whenStable();
    expect(searchInput(el).value).toBe('');
  });

  it('should_render_one_pill_per_active_key_in_order', async () => {
    const { fixture, host, el } = await setup();
    host.activeKeys.set(['type', 'actor', 'project', 'period']);
    host.filters.set({
      ...EMPTY_HISTORY_FILTERS,
      types: ['approved', 'merged'],
      actors: ['alice'],
      projects: [2],
      from: '2026-11-06',
    });
    await fixture.whenStable();
    const pills = Array.from(el.querySelectorAll('.pill-body')).map((n) => n.textContent?.replace(/\s+/g, ' ').trim());
    expect(pills[0]).toContain(`${t('history.filters.names.type')} : ${t('settings.notifications.types.labels.approved')}, ${t('settings.notifications.types.labels.merged')}`);
    expect(pills[1]).toContain(`${t('history.filters.names.actor')} : Alice Martin`);
    expect(pills[2]).toContain(`${t('history.filters.names.project')} : web`);
    expect(pills[3]).toContain(t('history.filters.names.period'));
  });

  it('should_offer_unknown_first_then_actors_with_a_username_fallback', async () => {
    const { fixture, host, el, loader } = await setup();
    host.activeKeys.set(['actor']);
    await fixture.whenStable();
    expect(el.querySelector('.pill-body')).not.toBeNull();
    const pillMenu = await loader.getHarness(MatMenuHarness.with({ triggerText: /Acteur/ }));
    await pillMenu.open();
    const labels = Array.from(document.querySelectorAll('.menu-option .option-label')).map((n) => n.textContent);
    expect(labels).toEqual([t('history.unknownActor'), 'Alice Martin', 'ghost']);
  });

  it('should_emit_toggles_with_typed_values_and_removal', async () => {
    const { fixture, host, el, loader } = await setup();
    host.activeKeys.set(['type', 'project']);
    await fixture.whenStable();

    const typeMenu = await loader.getHarness(MatMenuHarness.with({ triggerText: /Type/ }));
    await typeMenu.open();
    document.querySelector<HTMLElement>('.menu-option')!.click();
    await typeMenu.close();

    const projectMenu = await loader.getHarness(MatMenuHarness.with({ triggerText: /Projet/ }));
    await projectMenu.open();
    // Le panneau « Type » fermé peut rester dans le DOM le temps de son animation : on cible le dernier ouvert.
    Array.from(document.querySelectorAll('.menu-options')).at(-1)!.querySelectorAll<HTMLElement>('.menu-option')[1].click();
    await projectMenu.close();

    el.querySelector<HTMLButtonElement>('.pill-remove')!.click();
    expect(host.events).toEqual([
      ['type', 'created'],
      ['project', 2],
      ['remove', 'type'],
    ]);
  });

  it('should_list_the_four_filters_in_the_add_menu_and_disable_active_ones', async () => {
    const { fixture, host, loader } = await setup();
    host.activeKeys.set(['actor']);
    await fixture.whenStable();
    const menu = await loader.getHarness(MatMenuHarness.with({ triggerText: new RegExp(t('history.filters.add')) }));
    await menu.open();
    const items = await menu.getItems();
    expect(items).toHaveLength(4);
    const disabled = await Promise.all(items.map((item) => item.isDisabled()));
    expect(disabled).toEqual([false, true, false, false]);
    await items[0].click();
    expect(host.events).toEqual([['add', 'type']]);
  });

  it('should_disable_the_add_button_when_every_filter_is_displayed', async () => {
    const { fixture, host, el } = await setup();
    host.activeKeys.set(['type', 'actor', 'project', 'period']);
    await fixture.whenStable();
    expect(el.querySelector<HTMLButtonElement>('.add-filter')!.disabled).toBe(true);
  });

  it('should_show_clear_only_with_a_filter_and_emit_it', async () => {
    const { fixture, host, el } = await setup();
    host.hasFilter.set(true);
    await fixture.whenStable();
    el.querySelector<HTMLButtonElement>('.clear')!.click();
    expect(host.events).toEqual([['clear', null]]);
  });

  it('should_offer_a_search_field_in_the_project_menu_beyond_eight_projects', async () => {
    const { fixture, host, loader } = await setup();
    host.projects.set(
      Array.from({ length: 9 }, (_, i) => ({ ...PROJECTS[0], id: i + 1, alias: `p${i + 1}` })),
    );
    host.activeKeys.set(['project']);
    await fixture.whenStable();
    await (await loader.getHarness(MatMenuHarness.with({ triggerText: /Projet/ }))).open();
    expect(document.querySelector('.menu-search')).not.toBeNull();
  });
});
