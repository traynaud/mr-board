import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDatepickerInputHarness } from '@angular/material/datepicker/testing';
import { MatMenuHarness } from '@angular/material/menu/testing';
import { provideI18nTesting, t } from '../../../core/i18n/testing';
import { provideIcons } from '../../../shared/icons/provide-icons';
import { dayToDate } from '../../../core/url-state/history-query-params';
import { formatShortDate } from '../../../shared/format/format-date';
import { HistoryPeriod, HistoryPeriodPillComponent } from './history-period-pill.component';

@Component({
  imports: [HistoryPeriodPillComponent],
  template: `
    <app-history-period-pill
      [from]="from()"
      [to]="to()"
      (periodChange)="changes.push($event)"
      (remove)="removed = removed + 1"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly from = signal<string | null>(null);
  readonly to = signal<string | null>(null);
  changes: HistoryPeriod[] = [];
  removed = 0;
}

describe('HistoryPeriodPillComponent', () => {
  async function setup() {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideI18nTesting(), provideIcons()],
    }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const overlay = TestbedHarnessEnvironment.documentRootLoader(fixture);
    return { fixture, host: fixture.componentInstance, el: fixture.nativeElement as HTMLElement, loader, overlay };
  }

  const label = (el: HTMLElement) => el.querySelector('.pill-body')?.textContent?.replace(/\s+/g, ' ').trim();
  const name = t('history.filters.names.period');

  it('should_show_all_without_bounds', async () => {
    const { el } = await setup();
    expect(label(el)).toContain(`${name} : ${t('history.filters.all')}`);
  });

  it('should_show_both_bounds_or_an_ellipsis_for_a_missing_one', async () => {
    const { fixture, host, el } = await setup();
    host.from.set('2026-11-06');
    host.to.set('2026-11-08');
    await fixture.whenStable();
    expect(label(el)).toContain(`${name} : ${formatShortDate('2026-11-06')} → ${formatShortDate('2026-11-08')}`);
    host.to.set(null);
    await fixture.whenStable();
    expect(label(el)).toContain(`${formatShortDate('2026-11-06')} → …`);
    host.from.set(null);
    host.to.set('2026-11-08');
    await fixture.whenStable();
    expect(label(el)).toContain(`… → ${formatShortDate('2026-11-08')}`);
  });

  it('should_emit_remove_from_the_cross', async () => {
    const { el, host } = await setup();
    el.querySelector<HTMLButtonElement>('.pill-remove')!.click();
    expect(host.removed).toBe(1);
  });

  it('should_prefill_the_date_inputs_and_bound_one_by_the_other', async () => {
    const { fixture, host, loader, overlay } = await setup();
    host.from.set('2026-11-06');
    host.to.set('2026-11-08');
    await fixture.whenStable();
    await (await loader.getHarness(MatMenuHarness)).open();
    const inputs = await overlay.getAllHarnesses(MatDatepickerInputHarness);
    expect(inputs).toHaveLength(2);
    // L'adaptateur natif sérialise `min` / `max` en UTC : on compare avec la même conversion.
    const utcDay = (day: string) => dayToDate(day).toISOString().slice(0, 10);
    expect(await inputs[0].getMax()).toBe(utcDay('2026-11-08'));
    expect(await inputs[1].getMin()).toBe(utcDay('2026-11-06'));
  });

  it('should_emit_the_new_period_when_a_bound_changes', async () => {
    const { fixture, host, loader, overlay } = await setup();
    host.to.set('2026-11-08');
    await fixture.whenStable();
    await (await loader.getHarness(MatMenuHarness)).open();
    const [from] = await overlay.getAllHarnesses(MatDatepickerInputHarness);
    await from.setValue('2026-11-05');
    await from.blur();
    expect(host.changes.at(-1)).toEqual({ from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), to: '2026-11-08' });
  });

  it('should_clear_both_bounds_with_the_clear_button', async () => {
    const { fixture, host, loader } = await setup();
    host.from.set('2026-11-06');
    await fixture.whenStable();
    await (await loader.getHarness(MatMenuHarness)).open();
    document.querySelector<HTMLButtonElement>('.menu-period > button')!.click();
    expect(host.changes.at(-1)).toEqual({ from: null, to: null });
  });

  it('should_let_escape_close_the_menu_from_inside_the_date_fields_but_keep_other_keys_local', async () => {
    const { fixture, loader } = await setup();
    const menu = await loader.getHarness(MatMenuHarness);
    await menu.open();
    const panel = document.querySelector<HTMLElement>('.menu-period')!;
    const seen: string[] = [];
    document.addEventListener('keydown', (event) => seen.push(event.key));
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(seen).toEqual(['Escape']);
  });
});
