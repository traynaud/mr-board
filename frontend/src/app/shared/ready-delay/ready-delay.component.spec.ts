import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatTooltip } from '@angular/material/tooltip';
import { By } from '@angular/platform-browser';
import { provideI18nTesting, t } from '../../core/i18n/testing';
import { ReadyLevel } from '../../models/merge-request.model';
import { formatDateTime } from '../format/format-date';
import { ReadyDelayComponent } from './ready-delay.component';

@Component({
  imports: [ReadyDelayComponent],
  template: `
    <app-ready-delay
      [draft]="draft()"
      [readyAt]="readyAt()"
      [readyDays]="readyDays()"
      [readyLevel]="readyLevel()"
      [openedDays]="openedDays()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly draft = signal(false);
  readonly readyAt = signal<string | null>('2026-09-05T14:30:00.000Z');
  readonly readyDays = signal<number | null>(6);
  readonly readyLevel = signal<ReadyLevel | null>('red');
  readonly openedDays = signal(6);
}

describe('ReadyDelayComponent', () => {
  const setup = async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  };

  it('should_render_a_colored_square_and_bold_label_for_a_ready_merge_request', async () => {
    const { el } = await setup();

    expect(el.querySelector('.ready')?.classList.contains('red')).toBe(true);
    expect(el.querySelector('.label')?.textContent?.trim()).toBe(
      t('board.mergeRequests.ready.days', { days: 6 }),
    );
    expect(el.querySelector('.opened')).toBeNull();
  });

  it('should_show_a_localised_datetime_tooltip', async () => {
    const { fixture, el } = await setup();

    const tooltip = fixture.debugElement.query(By.directive(MatTooltip)).injector.get(MatTooltip);
    expect(tooltip.message).toBe(
      t('board.mergeRequests.ready.tooltip', {
        date: formatDateTime('2026-09-05T14:30:00.000Z'),
      }),
    );
    expect(el.querySelector('.ready')).not.toBeNull();
  });

  it('should_show_today_when_ready_days_is_zero', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.readyDays.set(0);
    fixture.componentInstance.readyLevel.set('green');
    await fixture.whenStable();

    expect(el.querySelector('.label')?.textContent?.trim()).toBe(
      t('board.mergeRequests.ready.today'),
    );
    expect(el.querySelector('.ready')?.classList.contains('green')).toBe(true);
  });

  it.each<[ReadyLevel]>([['green'], ['orange']])(
    'should_apply_the_%s_color_class',
    async (level) => {
      const { fixture, el } = await setup();
      fixture.componentInstance.readyLevel.set(level);
      await fixture.whenStable();

      expect(el.querySelector('.ready')?.classList.contains(level)).toBe(true);
    },
  );

  it('should_show_a_gray_opened_label_without_square_or_tooltip_for_a_draft', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.draft.set(true);
    fixture.componentInstance.readyAt.set(null);
    fixture.componentInstance.readyDays.set(null);
    fixture.componentInstance.readyLevel.set(null);
    fixture.componentInstance.openedDays.set(12);
    await fixture.whenStable();

    expect(el.querySelector('.opened')?.textContent?.trim()).toBe(
      t('board.mergeRequests.ready.openedDays', { days: 12 }),
    );
    expect(el.querySelector('.ready')).toBeNull();
    expect(el.querySelector('.square')).toBeNull();
  });

  it('should_show_no_tooltip_when_ready_at_is_null_but_draft_is_false', async () => {
    // Defensive case: the DTO invariant guarantees readyAt is null only for
    // a draft, but this component's inputs are independent, so it must
    // still degrade gracefully if a caller ever passes this combination.
    const { fixture, el } = await setup();
    fixture.componentInstance.readyAt.set(null);
    await fixture.whenStable();

    const tooltip = fixture.debugElement.query(By.directive(MatTooltip)).injector.get(MatTooltip);
    expect(tooltip.message).toBe('');
    expect(el.querySelector('.ready')).not.toBeNull();
  });

  it('should_show_opened_today_when_a_draft_was_opened_today', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.draft.set(true);
    fixture.componentInstance.readyAt.set(null);
    fixture.componentInstance.readyDays.set(null);
    fixture.componentInstance.readyLevel.set(null);
    fixture.componentInstance.openedDays.set(0);
    await fixture.whenStable();

    expect(el.querySelector('.opened')?.textContent?.trim()).toBe(
      t('board.mergeRequests.ready.openedToday'),
    );
  });
});
