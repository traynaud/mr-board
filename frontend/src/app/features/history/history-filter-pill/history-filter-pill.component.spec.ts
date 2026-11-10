import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatMenuHarness } from '@angular/material/menu/testing';
import { provideI18nTesting, t } from '../../../core/i18n/testing';
import { provideIcons } from '../../../shared/icons/provide-icons';
import { HistoryFilterOption, HistoryFilterPillComponent } from './history-filter-pill.component';

const OPTIONS: HistoryFilterOption[] = [
  { value: 'alice', label: 'Alice Martin', sublabel: '@alice' },
  { value: 'bob', label: 'Bob Leroy', sublabel: '@bob' },
  { value: 'carol', label: 'Carole Diaz', sublabel: '@carol' },
  { value: 'api', label: 'api', swatch: { id: 'slate', background: '#c7d9ea', text: '#20303f', labelKey: 'settings.connections.repos.colors.slate' } },
];

@Component({
  imports: [HistoryFilterPillComponent],
  template: `
    <app-history-filter-pill
      name="Acteur"
      [options]="options"
      [selected]="selected()"
      [searchable]="searchable()"
      (toggleValue)="toggled.push($event)"
      (remove)="removed = removed + 1"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly options = OPTIONS;
  readonly selected = signal<string[]>([]);
  readonly searchable = signal(false);
  toggled: string[] = [];
  removed = 0;
}

describe('HistoryFilterPillComponent', () => {
  async function setup() {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideI18nTesting(), provideIcons()],
    }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const loader = TestbedHarnessEnvironment.loader(fixture);
    return { fixture, host: fixture.componentInstance, el: fixture.nativeElement as HTMLElement, loader };
  }

  const label = (el: HTMLElement) => el.querySelector('.pill-body')?.textContent?.replace(/\s+/g, ' ').trim();

  it('should_show_all_without_selection', async () => {
    const { el } = await setup();
    expect(label(el)).toContain(`Acteur : ${t('history.filters.all')}`);
  });

  it('should_list_the_selected_labels_and_summarise_beyond_two', async () => {
    const { fixture, host, el } = await setup();
    host.selected.set(['alice', 'bob']);
    await fixture.whenStable();
    expect(label(el)).toContain('Acteur : Alice Martin, Bob Leroy');
    expect(label(el)).not.toContain('+');
    host.selected.set(['alice', 'bob', 'carol']);
    await fixture.whenStable();
    expect(label(el)).toContain('Acteur : Alice Martin, Bob Leroy +1');
  });

  it('should_fall_back_to_the_raw_value_of_an_unknown_option', async () => {
    const { fixture, host, el } = await setup();
    host.selected.set(['zoe']);
    await fixture.whenStable();
    expect(label(el)).toContain('Acteur : zoe');
  });

  it('should_emit_remove_from_the_cross_with_an_accessible_name', async () => {
    const { el, host } = await setup();
    const cross = el.querySelector<HTMLButtonElement>('.pill-remove')!;
    expect(cross.getAttribute('aria-label')).toBe(t('history.filters.remove', { name: 'Acteur' }));
    cross.click();
    expect(host.removed).toBe(1);
  });

  it('should_toggle_options_from_the_menu_and_keep_it_open', async () => {
    const { fixture, host, loader } = await setup();
    const menu = await loader.getHarness(MatMenuHarness);
    await menu.open();
    const options = document.querySelectorAll<HTMLElement>('.menu-option');
    expect(options).toHaveLength(OPTIONS.length);
    expect(options[0].textContent).toContain('Alice Martin');
    expect(options[0].textContent).toContain('@alice');
    expect(options[3].querySelector('.option-swatch')).not.toBeNull();
    options[1].click();
    options[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    expect(host.toggled).toEqual(['bob', 'carol']);
    expect(await menu.isOpen()).toBe(true);
  });

  it('should_reflect_the_checked_state_in_the_menu', async () => {
    const { fixture, host, loader } = await setup();
    host.selected.set(['bob']);
    await fixture.whenStable();
    await (await loader.getHarness(MatMenuHarness)).open();
    const checked = Array.from(document.querySelectorAll('.menu-option')).map((n) => n.getAttribute('aria-checked'));
    expect(checked).toEqual(['false', 'true', 'false', 'false']);
  });

  it('should_filter_options_with_the_search_field_when_searchable', async () => {
    const { fixture, host, loader } = await setup();
    host.searchable.set(true);
    await fixture.whenStable();
    await (await loader.getHarness(MatMenuHarness)).open();
    const input = document.querySelector<HTMLInputElement>('.menu-search input')!;
    input.value = 'carol';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    const shown = Array.from(document.querySelectorAll('.menu-option .option-label')).map((n) => n.textContent);
    expect(shown).toEqual(['Carole Diaz']);
  });

  it('should_not_show_the_search_field_by_default', async () => {
    const { loader } = await setup();
    await (await loader.getHarness(MatMenuHarness)).open();
    expect(document.querySelector('.menu-search')).toBeNull();
  });

  it('should_let_escape_reach_the_menu_from_the_option_search_field', async () => {
    const { fixture, host, loader } = await setup();
    host.searchable.set(true);
    await fixture.whenStable();
    await (await loader.getHarness(MatMenuHarness)).open();
    const seen: string[] = [];
    document.addEventListener('keydown', (event) => seen.push(event.key));
    const field = document.querySelector<HTMLElement>('.menu-search')!;
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(seen).toEqual(['Escape']);
  });
});
