import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatChipListboxHarness, MatChipOptionHarness } from '@angular/material/chips/testing';
import { MatMenuHarness } from '@angular/material/menu/testing';
import { MatTooltip } from '@angular/material/tooltip';
import { By } from '@angular/platform-browser';
import { provideI18nTesting, t } from '../../../core/i18n/testing';
import {
  ComposableFilters,
  EMPTY_COMPOSABLE_FILTERS,
  FilterKey,
  MergeRequestView,
  MergeRequestsFacets,
} from '../../../models/merge-request.model';
import { provideIcons } from '../../../shared/icons/provide-icons';
import { FilterBarComponent } from './filter-bar.component';

const EMPTY_FACETS: MergeRequestsFacets = {
  connection: [{ value: 'GitLab', label: 'GitLab', count: 2 }],
  project: [{ value: 'api', label: 'api · equipe/backend-api', count: 2 }],
  author: [],
  assigned: [{ value: 'nobody', label: 'Nobody', count: 2 }],
  approved: [
    { value: 'yes', label: 'Oui', count: 0 },
    { value: 'no', label: 'Non', count: 2 },
  ],
  commented: [
    { value: 'yes', label: 'Oui', count: 0 },
    { value: 'no', label: 'Non', count: 2 },
  ],
  label: [{ value: 'none', label: 'Sans label', count: 0 }],
};

function mr(overrides: Partial<MergeRequestView> = {}): MergeRequestView {
  return {
    id: 1,
    projectAlias: 'api',
    iid: 1,
    title: 'Title',
    webUrl: 'https://gitlab.com/equipe/api/-/merge_requests/1',
    draft: false,
    labels: [],
    author: { username: 'mdupont', name: 'Marie Dupont', avatarUrl: null, isMe: false },
    reviewers: [],
    assignees: [],
    approved: false,
    commentsCount: 0,
    difficulty: 'easy',
    changedFiles: 1,
    additions: 1,
    deletions: 0,
    changedLines: 1,
    createdAt: '2026-09-01T10:00:00.000Z',
    readyAt: '2026-09-01T10:00:00.000Z',
    readyDays: 1,
    readyLevel: 'green',
    openedDays: 1,
    isMine: false,
    isFavorite: false,
    mergeStatus: { state: 'mergeable', reasons: [] },
    connection: { id: 1, name: 'GitLab', type: 'gitlab' },
    ...overrides,
  };
}

@Component({
  imports: [FilterBarComponent],
  template: `
    <app-filter-bar
      [drafts]="drafts()"
      [mine]="mine()"
      [favorites]="favorites()"
      [identityConfigured]="identityConfigured()"
      [rows]="rows()"
      [active]="active()"
      [composableFilters]="composableFilters()"
      [facets]="facets()"
      [showConnectionFilter]="showConnectionFilter()"
      [search]="search()"
      (draftsToggle)="draftsToggleCount = draftsToggleCount + 1"
      (mineToggle)="mineToggleCount = mineToggleCount + 1"
      (favoritesToggle)="favoritesToggleCount = favoritesToggleCount + 1"
      (clearFilters)="clearCount = clearCount + 1"
      (filterAdd)="added.push($event)"
      (filterRemove)="removed.push($event)"
      (filterToggleValue)="toggled.push($event)"
      (filterSelectBoolean)="selectedBoolean.push($event)"
      (searchChange)="searchChanges.push($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly drafts = signal(false);
  readonly mine = signal(false);
  readonly favorites = signal(false);
  readonly identityConfigured = signal(true);
  readonly rows = signal<MergeRequestView[]>([mr({ id: 1 }), mr({ id: 2, projectAlias: 'web' })]);
  readonly active = signal<FilterKey[]>([]);
  readonly composableFilters = signal<ComposableFilters>(EMPTY_COMPOSABLE_FILTERS);
  readonly facets = signal<MergeRequestsFacets | null>(EMPTY_FACETS);
  readonly showConnectionFilter = signal(true);
  readonly search = signal('');
  draftsToggleCount = 0;
  mineToggleCount = 0;
  favoritesToggleCount = 0;
  clearCount = 0;
  added: FilterKey[] = [];
  removed: FilterKey[] = [];
  toggled: { key: FilterKey; value: string }[] = [];
  selectedBoolean: { key: FilterKey; value: 'yes' | 'no' }[] = [];
  searchChanges: string[] = [];
}

describe('FilterBarComponent', () => {
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

  it('should_render_the_drafts_mine_and_favorites_chips', async () => {
    const { loader } = await setup();
    const listbox = await loader.getHarness(MatChipListboxHarness);
    const chips = await listbox.getChips();

    expect(chips).toHaveLength(3);
    expect(await chips[0].getText()).toBe(t('board.filters.drafts'));
    expect(await chips[1].getText()).toBe(t('board.filters.mine'));
    expect(await chips[2].getText()).toBe(t('board.filters.favorites'));
  });

  it('should_reflect_the_drafts_and_mine_selected_state', async () => {
    const { fixture, loader } = await setup();
    fixture.componentInstance.drafts.set(true);
    await fixture.whenStable();

    const draftsChip = await loader.getHarness(
      MatChipOptionHarness.with({ text: t('board.filters.drafts') }),
    );
    expect(await draftsChip.isSelected()).toBe(true);

    const mineChip = await loader.getHarness(
      MatChipOptionHarness.with({ text: t('board.filters.mine') }),
    );
    expect(await mineChip.isSelected()).toBe(false);
  });

  it('should_emit_drafts_toggle_when_the_drafts_chip_is_clicked', async () => {
    const { fixture, loader } = await setup();
    const draftsChip = await loader.getHarness(
      MatChipOptionHarness.with({ text: t('board.filters.drafts') }),
    );

    await draftsChip.toggle();

    expect(fixture.componentInstance.draftsToggleCount).toBe(1);
  });

  it('should_emit_mine_toggle_when_the_mine_chip_is_clicked', async () => {
    const { fixture, loader } = await setup();
    const mineChip = await loader.getHarness(
      MatChipOptionHarness.with({ text: t('board.filters.mine') }),
    );

    await mineChip.toggle();

    expect(fixture.componentInstance.mineToggleCount).toBe(1);
  });

  it('should_reflect_the_favorites_selected_state_rg_027_10', async () => {
    const { fixture, loader } = await setup();
    fixture.componentInstance.favorites.set(true);
    await fixture.whenStable();

    const favoritesChip = await loader.getHarness(
      MatChipOptionHarness.with({ text: t('board.filters.favorites') }),
    );
    expect(await favoritesChip.isSelected()).toBe(true);
  });

  it('should_emit_favorites_toggle_when_the_favorites_chip_is_clicked_rg_027_10', async () => {
    const { fixture, loader } = await setup();
    const favoritesChip = await loader.getHarness(
      MatChipOptionHarness.with({ text: t('board.filters.favorites') }),
    );

    await favoritesChip.toggle();

    expect(fixture.componentInstance.favoritesToggleCount).toBe(1);
  });

  it('should_disable_the_mine_chip_and_show_a_tooltip_when_identity_is_not_configured', async () => {
    const { fixture, el, loader } = await setup();
    fixture.componentInstance.identityConfigured.set(false);
    await fixture.whenStable();

    const mineChip = await loader.getHarness(
      MatChipOptionHarness.with({ text: t('board.filters.mine') }),
    );
    expect(await mineChip.isDisabled()).toBe(true);

    const tooltip = fixture.debugElement.query(By.directive(MatTooltip)).injector.get(MatTooltip);
    expect(tooltip.message).toBe(t('board.filters.mineDisabledTooltip'));
    expect(el.querySelector('.count')).not.toBeNull();
  });

  it('should_show_the_count_label_with_pluralised_mrs_and_projects', async () => {
    const { el } = await setup();

    expect(el.querySelector('.count')?.textContent?.trim()).toBe(
      t('board.filters.count', { count: 2, countSuffix: 's', projects: 2, projectsSuffix: 's' }),
    );
  });

  it('should_hide_the_clear_button_when_no_filter_is_active', async () => {
    const { el } = await setup();

    expect(el.querySelector('.summary button')).toBeNull();
  });

  it('should_hide_the_search_field_until_the_title_filter_is_added', async () => {
    // Bug : le champ de recherche était affiché en permanence, hors du
    // mécanisme des filtres composables (sélection/ajout/suppression). Il ne
    // doit apparaître qu'une fois « Titre » ajouté depuis « Ajouter un
    // filtre », comme n'importe quel autre filtre de la liste.
    const { el } = await setup();

    expect(el.querySelector('.search-field')).toBeNull();
  });

  it('should_show_the_search_field_with_its_placeholder_rg_026_01', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.active.set(['search']);
    await fixture.whenStable();

    const input = el.querySelector<HTMLInputElement>('.search-field input');
    expect(input?.placeholder).toBe(t('board.filters.searchPlaceholder'));
  });

  it('should_emit_search_change_on_input_rg_026_09', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.active.set(['search']);
    await fixture.whenStable();
    const input = el.querySelector<HTMLInputElement>('.search-field input')!;

    input.value = 'facturation';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(fixture.componentInstance.searchChanges).toEqual(['facturation']);
  });

  it('should_show_a_remove_button_for_the_search_pill_like_any_other_filter', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.active.set(['search']);
    await fixture.whenStable();

    const button = el.querySelector<HTMLButtonElement>('.search-pill .pill-remove');
    expect(button?.getAttribute('aria-label')).toBe(
      t('board.filters.pills.remove', { name: t('board.filters.pills.names.search') }),
    );
  });

  it('should_emit_filter_remove_for_search_and_clear_its_text_when_the_remove_button_is_clicked', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.active.set(['search']);
    fixture.componentInstance.search.set('facturation');
    await fixture.whenStable();

    el.querySelector<HTMLButtonElement>('.search-pill .pill-remove')?.click();

    expect(fixture.componentInstance.removed).toEqual(['search']);
  });

  it('should_show_the_clear_button_when_the_search_filter_is_active_even_without_other_filters_rg_026_11', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.active.set(['search']);
    await fixture.whenStable();

    expect(el.querySelector('.summary button')).not.toBeNull();
  });

  it('should_show_the_clear_button_and_emit_clear_filters_when_mine_is_active', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.mine.set(true);
    await fixture.whenStable();

    const button = el.querySelector<HTMLButtonElement>('.summary button');
    expect(button?.textContent?.trim()).toBe(t('board.filters.clear'));

    button?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.clearCount).toBe(1);
  });

  it('should_show_the_clear_button_when_a_composable_filter_is_active_even_without_mine', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.active.set(['project']);
    await fixture.whenStable();

    expect(el.querySelector('.summary button')).not.toBeNull();
  });

  it('should_show_the_clear_button_when_favorites_is_active_rg_027_11', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.favorites.set(true);
    await fixture.whenStable();

    expect(el.querySelector('.summary button')).not.toBeNull();
  });

  it('should_render_one_pill_per_active_filter_with_its_facet_options', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.active.set(['project', 'approved']);
    await fixture.whenStable();

    expect(el.querySelectorAll('app-filter-pill')).toHaveLength(2);
  });

  it('should_pass_the_current_multi_selection_to_the_matching_pill', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.active.set(['project']);
    fixture.componentInstance.composableFilters.set({
      ...EMPTY_COMPOSABLE_FILTERS,
      project: ['api'],
    });
    await fixture.whenStable();

    expect(el.querySelector('app-filter-pill .pill-body')?.textContent).toContain('api');
  });

  it('should_emit_filter_remove_with_the_filter_key_when_a_pill_cross_is_clicked', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.active.set(['project']);
    await fixture.whenStable();

    el.querySelector<HTMLButtonElement>('app-filter-pill .pill-remove')?.click();

    expect(fixture.componentInstance.removed).toEqual(['project']);
  });

  it('should_render_the_add_filter_menu', async () => {
    const { el } = await setup();

    expect(el.querySelector('app-add-filter-menu')).not.toBeNull();
  });

  it('should_emit_filter_add_when_a_filter_is_chosen_in_the_add_menu', async () => {
    const { fixture, loader } = await setup();
    const addFilterMenu = await loader.getHarness(MatMenuHarness);
    await addFilterMenu.open();
    const items = await addFilterMenu.getItems();
    // RG-026-01 : « Titre » est en tête du menu, RG-021-03 : « Connexion » juste après par défaut.
    await items[1].click();

    expect(fixture.componentInstance.added).toEqual(['connection']);
  });

  it('should_hide_the_connection_filter_from_the_add_menu_when_asked_rg_021_03', async () => {
    const { fixture, loader } = await setup();
    fixture.componentInstance.showConnectionFilter.set(false);
    await fixture.whenStable();
    const addFilterMenu = await loader.getHarness(MatMenuHarness);
    await addFilterMenu.open();
    const items = await addFilterMenu.getItems();
    await items[1].click();

    expect(fixture.componentInstance.added).toEqual(['project']);
  });
});
