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
    <app-add-filter-menu [active]="active()" (addFilter)="added.push($event)" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly active = signal<FilterKey[]>([]);
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

  it('should_list_all_5_filters_in_the_menu', async () => {
    const { loader } = await setup();
    const menu = await loader.getHarness(MatMenuHarness);
    await menu.open();
    const items = await menu.getItems();

    expect(items).toHaveLength(5);
    expect(await items[0].getText()).toBe(t('board.filters.pills.names.project'));
  });

  it('should_emit_add_filter_when_an_inactive_filter_is_clicked', async () => {
    const { fixture, loader } = await setup();
    const menu = await loader.getHarness(MatMenuHarness);
    await menu.open();
    const items = await menu.getItems();

    await items[0].click();

    expect(fixture.componentInstance.added).toEqual(['project']);
  });

  it('should_disable_and_check_an_already_active_filter', async () => {
    const { fixture, loader } = await setup();
    fixture.componentInstance.active.set(['project']);
    await fixture.whenStable();
    const menu = await loader.getHarness(MatMenuHarness);
    await menu.open();
    const items = await menu.getItems();

    expect(await items[0].isDisabled()).toBe(true);
    expect(await items[1].isDisabled()).toBe(false);
  });

  it('should_disable_the_button_itself_when_all_5_filters_are_active', async () => {
    const { fixture, loader } = await setup();
    fixture.componentInstance.active.set(['project', 'author', 'assigned', 'approved', 'commented']);
    await fixture.whenStable();

    const button = await loader.getHarness(MatButtonHarness);
    expect(await button.isDisabled()).toBe(true);
  });
});
