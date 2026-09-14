import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatMenuHarness } from '@angular/material/menu/testing';
import { provideI18nTesting, t } from '../../core/i18n/testing';
import { provideIcons } from '../icons/provide-icons';
import { ProjectColorPickerComponent } from './project-color-picker.component';

@Component({
  imports: [ProjectColorPickerComponent],
  template: `<app-project-color-picker
    [value]="value()"
    name="web/api"
    (valueChange)="changes.push($event)"
  />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly value = signal<string | null>(null);
  changes: (string | null)[] = [];
}

describe('ProjectColorPickerComponent', () => {
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

  it('should_list_none_followed_by_the_ten_palette_colors_rg_025_02', async () => {
    const { loader } = await setup();
    const menu = await loader.getHarness(MatMenuHarness);
    await menu.open();
    const items = await menu.getItems();

    expect(items).toHaveLength(11);
    expect(await items[0].getText()).toBe(t('settings.connections.repos.colors.none'));
    expect(await items[1].getText()).toBe(t('settings.connections.repos.colors.slate'));
  });

  it('should_check_the_currently_selected_color', async () => {
    const { fixture, loader } = await setup();
    fixture.componentInstance.value.set('sage');
    await fixture.whenStable();
    const menu = await loader.getHarness(MatMenuHarness);
    await menu.open();
    const items = await menu.getItems();
    const sageIndex = 1 + ['slate', 'sage'].indexOf('sage');

    const texts = await Promise.all(items.map((item) => item.getText()));
    expect(texts[sageIndex]).toBe(t('settings.connections.repos.colors.sage'));
  });

  it('should_default_to_none_selected_when_value_is_null_rg_025_01', async () => {
    const { el, loader } = await setup();
    const menu = await loader.getHarness(MatMenuHarness);
    await menu.open();

    expect(el.querySelector('.swatch-trigger .swatch.none')).not.toBeNull();
  });

  it('should_emit_the_chosen_color_id', async () => {
    const { fixture, loader } = await setup();
    const menu = await loader.getHarness(MatMenuHarness);
    await menu.open();
    const items = await menu.getItems();

    await items[1].click();

    expect(fixture.componentInstance.changes).toEqual(['slate']);
  });

  it('should_emit_null_when_none_is_chosen', async () => {
    const { fixture, loader } = await setup();
    fixture.componentInstance.value.set('sage');
    await fixture.whenStable();
    const menu = await loader.getHarness(MatMenuHarness);
    await menu.open();
    const items = await menu.getItems();

    await items[0].click();

    expect(fixture.componentInstance.changes).toEqual([null]);
  });

  it('should_expose_the_repo_name_in_the_trigger_aria_label', async () => {
    const { el } = await setup();

    expect(el.querySelector('.swatch-trigger')?.getAttribute('aria-label')).toBe(
      t('settings.connections.repos.colors.pickerLabel', {
        alias: 'web/api',
        color: t('settings.connections.repos.colors.none'),
      }),
    );
  });
});
