import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatMenuHarness } from '@angular/material/menu/testing';
import { provideI18nTesting, t } from '../../../../core/i18n/testing';
import { FacetOption, FilterKey } from '../../../../models/merge-request.model';
import { provideIcons } from '../../../../shared/icons/provide-icons';
import { FilterPillComponent } from './filter-pill.component';

const PROJECT_OPTIONS: FacetOption[] = [
  { value: 'api', label: 'api · equipe/backend-api', count: 3 },
  { value: 'web', label: 'web · equipe/front-web', count: 0 },
];
const AUTHOR_OPTIONS: FacetOption[] = [
  { value: 'mdupont', label: 'Marie Dupont', count: 2 },
  { value: 'kbenali', label: 'Karim Benali', count: 1 },
];
const ASSIGNED_OPTIONS: FacetOption[] = [
  { value: 'nobody', label: 'Nobody', count: 2 },
  { value: 'mdupont', label: 'Marie Dupont', count: 1 },
];
const APPROVED_OPTIONS: FacetOption[] = [
  { value: 'yes', label: 'Oui', count: 1 },
  { value: 'no', label: 'Non', count: 2 },
];

@Component({
  imports: [FilterPillComponent],
  template: `
    <app-filter-pill
      [filterKey]="filterKey()"
      [options]="options()"
      [multiSelected]="multiSelected()"
      [booleanSelected]="booleanSelected()"
      (toggleValue)="toggled.push($event)"
      (selectBoolean)="selectedBoolean.push($event)"
      (remove)="removeCount = removeCount + 1"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly filterKey = signal<FilterKey>('project');
  readonly options = signal<FacetOption[]>(PROJECT_OPTIONS);
  readonly multiSelected = signal<string[]>([]);
  readonly booleanSelected = signal<'yes' | 'no' | null>(null);
  toggled: string[] = [];
  selectedBoolean: ('yes' | 'no')[] = [];
  removeCount = 0;
}

describe('FilterPillComponent', () => {
  const setup = async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideI18nTesting(), provideIcons()],
    }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const loader: HarnessLoader = TestbedHarnessEnvironment.loader(fixture);
    return { fixture, el: fixture.nativeElement as HTMLElement, loader };
  };

  it('should_show_tous_when_no_multi_value_is_selected', async () => {
    const { el } = await setup();

    expect(el.querySelector('.pill-body')?.textContent).toContain(
      `${t('board.filters.pills.names.project')} : ${t('board.filters.pills.all')}`,
    );
  });

  it('should_join_selected_project_aliases_with_a_comma', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.multiSelected.set(['api', 'web']);
    await fixture.whenStable();

    expect(el.querySelector('.pill-body')?.textContent).toContain(
      `${t('board.filters.pills.names.project')} : api, web`,
    );
  });

  it('should_show_initials_for_selected_authors', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.filterKey.set('author');
    fixture.componentInstance.options.set(AUTHOR_OPTIONS);
    fixture.componentInstance.multiSelected.set(['mdupont']);
    await fixture.whenStable();

    expect(el.querySelector('.pill-body')?.textContent).toContain(
      `${t('board.filters.pills.names.author')} : MD`,
    );
  });

  it('should_show_the_nobody_label_as_is_in_assigned', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.filterKey.set('assigned');
    fixture.componentInstance.options.set(ASSIGNED_OPTIONS);
    fixture.componentInstance.multiSelected.set(['nobody']);
    await fixture.whenStable();

    expect(el.querySelector('.pill-body')?.textContent).toContain(
      `${t('board.filters.pills.names.assigned')} : Nobody`,
    );
  });

  it('should_show_a_dash_when_no_boolean_value_is_selected', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.filterKey.set('approved');
    fixture.componentInstance.options.set(APPROVED_OPTIONS);
    await fixture.whenStable();

    expect(el.querySelector('.pill-body')?.textContent).toContain(
      `${t('board.filters.pills.names.approved')} : ${t('board.filters.pills.none')}`,
    );
  });

  it('should_show_the_selected_boolean_option_label', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.filterKey.set('approved');
    fixture.componentInstance.options.set(APPROVED_OPTIONS);
    fixture.componentInstance.booleanSelected.set('no');
    await fixture.whenStable();

    expect(el.querySelector('.pill-body')?.textContent).toContain(
      `${t('board.filters.pills.names.approved')} : Non`,
    );
  });

  it('should_emit_remove_when_the_cross_is_clicked', async () => {
    const { fixture, el } = await setup();

    el.querySelector<HTMLButtonElement>('.pill-remove')?.click();

    expect(fixture.componentInstance.removeCount).toBe(1);
  });

  it('should_set_an_aria_label_naming_the_filter_on_the_cross', async () => {
    const { el } = await setup();

    expect(el.querySelector('.pill-remove')?.getAttribute('aria-label')).toBe(
      t('board.filters.pills.remove', { name: t('board.filters.pills.names.project') }),
    );
  });

  it('should_open_the_menu_with_the_title_and_options_with_counts', async () => {
    const { loader } = await setup();
    const menu = await loader.getHarness(MatMenuHarness);
    await menu.open();

    // Panneau projeté dans l'overlay CDK, hors de `fixture.nativeElement`.
    const panelText = document.querySelector('.filter-pill-menu')?.textContent ?? '';
    expect(panelText).toContain(t('board.filters.pills.names.project'));
    expect(panelText).toContain('api · equipe/backend-api');
    expect(panelText).toContain('3');
  });

  it('should_toggle_a_multi_value_and_keep_the_menu_open', async () => {
    const { fixture, loader } = await setup();
    const menu = await loader.getHarness(MatMenuHarness);
    await menu.open();

    // Le panneau du mat-menu est projeté dans un overlay CDK attaché au
    // `document.body`, hors de `fixture.nativeElement` — d'où la requête DOM
    // directe plutôt qu'un `el.querySelector` scopé au fixture.
    document.querySelector<HTMLElement>('.menu-option')?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.toggled).toEqual(['api']);
    expect(await menu.isOpen()).toBe(true);
  });

  it('should_emit_select_boolean_when_an_option_is_clicked', async () => {
    const { fixture, loader } = await setup();
    fixture.componentInstance.filterKey.set('approved');
    fixture.componentInstance.options.set(APPROVED_OPTIONS);
    await fixture.whenStable();

    const menu = await loader.getHarness(MatMenuHarness);
    await menu.open();
    const items = await menu.getItems();
    await items[1].click();

    expect(fixture.componentInstance.selectedBoolean).toEqual(['no']);
  });

  it('should_not_show_a_search_field_with_6_options_or_fewer', async () => {
    const { loader } = await setup();
    const menu = await loader.getHarness(MatMenuHarness);
    await menu.open();

    const el = await menu.host();
    expect((await el.text()).includes(t('board.filters.pills.search'))).toBe(false);
  });

  it('should_show_and_apply_a_search_field_with_more_than_6_options', async () => {
    const manyOptions: FacetOption[] = Array.from({ length: 7 }, (_, i) => ({
      value: `u${i}`,
      label: `User ${i}`,
      count: i,
    }));
    const { fixture, loader } = await setup();
    fixture.componentInstance.filterKey.set('author');
    fixture.componentInstance.options.set(manyOptions);
    await fixture.whenStable();

    const menu = await loader.getHarness(MatMenuHarness);
    await menu.open();

    // Panneau projeté dans l'overlay CDK, hors de `fixture.nativeElement`.
    const input = document.querySelector<HTMLInputElement>('.menu-search input');
    expect(input).not.toBeNull();

    input!.value = 'User 3';
    input!.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    const labels = Array.from(document.querySelectorAll('.option-label')).map((n) =>
      n.textContent?.trim(),
    );
    expect(labels).toEqual(['User 3']);
  });
});
