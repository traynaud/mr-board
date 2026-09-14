import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatMenuHarness } from '@angular/material/menu/testing';
import { provideI18nTesting, t } from '../../../../core/i18n/testing';
import { FilterKey } from '../../../../models/merge-request.model';
import { provideIcons } from '../../../../shared/icons/provide-icons';
import { AddFilterMenuComponent } from './add-filter-menu.component';

@Component({
  imports: [AddFilterMenuComponent],
  template: `
    <app-add-filter-menu
      [active]="active()"
      [showConnectionFilter]="showConnectionFilter()"
      (addFilter)="added.push($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly active = signal<FilterKey[]>([]);
  readonly showConnectionFilter = signal(true);
  added: FilterKey[] = [];
}

describe('AddFilterMenuComponent', () => {
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

  it('should_show_the_button_label', async () => {
    const { el } = await setup();

    expect(el.querySelector('.add-filter-button')?.textContent?.trim()).toContain(
      t('board.filters.add'),
    );
  });

  it('should_list_all_7_filters_in_the_menu_with_search_first_rg_026_01', async () => {
    const { loader } = await setup();
    const menu = await loader.getHarness(MatMenuHarness);
    await menu.open();
    const items = await menu.getItems();

    expect(items).toHaveLength(7);
    expect(await items[0].getText()).toBe(t('board.filters.pills.names.search'));
    expect(await items[1].getText()).toBe(t('board.filters.pills.names.connection'));
    expect(await items[2].getText()).toBe(t('board.filters.pills.names.project'));
  });

  it('should_hide_the_connection_filter_when_there_are_fewer_than_2_connections_rg_021_03', async () => {
    const { fixture, loader } = await setup();
    fixture.componentInstance.showConnectionFilter.set(false);
    await fixture.whenStable();
    const menu = await loader.getHarness(MatMenuHarness);
    await menu.open();
    const items = await menu.getItems();

    expect(items).toHaveLength(6);
    expect(await items[0].getText()).toBe(t('board.filters.pills.names.search'));
    expect(await items[1].getText()).toBe(t('board.filters.pills.names.project'));
  });

  it('should_emit_add_filter_when_an_inactive_filter_is_clicked', async () => {
    const { fixture, loader } = await setup();
    const menu = await loader.getHarness(MatMenuHarness);
    await menu.open();
    const items = await menu.getItems();

    await items[0].click();

    expect(fixture.componentInstance.added).toEqual(['search']);
  });

  it('should_disable_and_check_an_already_active_filter', async () => {
    const { fixture, loader } = await setup();
    fixture.componentInstance.active.set(['search']);
    await fixture.whenStable();
    const menu = await loader.getHarness(MatMenuHarness);
    await menu.open();
    const items = await menu.getItems();

    expect(await items[0].isDisabled()).toBe(true);
    expect(await items[1].isDisabled()).toBe(false);
  });

  it('should_disable_the_button_itself_when_all_7_filters_are_active', async () => {
    const { fixture, loader } = await setup();
    fixture.componentInstance.active.set([
      'search',
      'connection',
      'project',
      'author',
      'assigned',
      'approved',
      'commented',
    ]);
    await fixture.whenStable();

    const button = await loader.getHarness(MatButtonHarness);
    expect(await button.isDisabled()).toBe(true);
  });

  it('should_disable_the_button_when_all_6_visible_filters_are_active_without_connection', async () => {
    const { fixture, loader } = await setup();
    fixture.componentInstance.showConnectionFilter.set(false);
    fixture.componentInstance.active.set([
      'search',
      'project',
      'author',
      'assigned',
      'approved',
      'commented',
    ]);
    await fixture.whenStable();

    const button = await loader.getHarness(MatButtonHarness);
    expect(await button.isDisabled()).toBe(true);
  });
});
