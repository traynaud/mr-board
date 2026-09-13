import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatTooltip } from '@angular/material/tooltip';
import { By } from '@angular/platform-browser';
import { provideI18nTesting, t } from '../../core/i18n/testing';
import { MergeStatus } from '../../models/merge-request.model';
import { MergeStatusIconComponent } from './merge-status-icon.component';

@Component({
  imports: [MergeStatusIconComponent],
  template: `<app-merge-status-icon [mergeStatus]="mergeStatus()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly mergeStatus = signal<MergeStatus>({ state: 'mergeable', reasons: [] });
}

describe('MergeStatusIconComponent', () => {
  const setup = async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  };

  function tooltipOf(fixture: ReturnType<typeof TestBed.createComponent<HostComponent>>): string {
    return fixture.debugElement.query(By.directive(MatTooltip)).injector.get(MatTooltip).message;
  }

  it('should_render_a_green_circle_check_for_mergeable', async () => {
    const { fixture, el } = await setup();

    expect(el.querySelector('.success')).not.toBeNull();
    expect(el.querySelector('.status-icon')?.getAttribute('tabindex')).toBe('0');
    expect(tooltipOf(fixture)).toBe(t('board.mergeRequests.mergeStatus.mergeable'));
    expect(el.querySelector('.status-icon')?.getAttribute('aria-label')).toBe(
      t('board.mergeRequests.mergeStatus.mergeable'),
    );
  });

  it('should_render_a_gray_dashed_circle_for_unknown', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.mergeStatus.set({ state: 'unknown', reasons: [] });
    await fixture.whenStable();

    expect(el.querySelector('.neutral')).not.toBeNull();
    expect(tooltipOf(fixture)).toBe(t('board.mergeRequests.mergeStatus.unknown'));
  });

  it('should_render_a_red_circle_x_with_a_multiline_tooltip_listing_every_reason_in_order', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.mergeStatus.set({
      state: 'blocked',
      reasons: [
        { code: 'conflicts' },
        { code: 'pipeline_failed' },
        { code: 'not_approved', count: 2 },
      ],
    });
    await fixture.whenStable();

    expect(el.querySelector('.danger')).not.toBeNull();
    expect(tooltipOf(fixture)).toBe(
      [
        t('board.mergeRequests.mergeStatus.blockedTitle'),
        `– ${t('board.mergeRequests.mergeStatus.reasons.conflicts')}`,
        `– ${t('board.mergeRequests.mergeStatus.reasons.pipeline_failed')}`,
        `– ${t('board.mergeRequests.mergeStatus.reasons.not_approved_count', { count: 2 })}`,
      ].join('\n'),
    );
  });

  it('should_fall_back_to_the_reason_label_without_a_count_when_absent', async () => {
    const { fixture } = await setup();
    fixture.componentInstance.mergeStatus.set({
      state: 'blocked',
      reasons: [{ code: 'not_approved' }],
    });
    await fixture.whenStable();

    expect(tooltipOf(fixture)).toBe(
      [
        t('board.mergeRequests.mergeStatus.blockedTitle'),
        `– ${t('board.mergeRequests.mergeStatus.reasons.not_approved')}`,
      ].join('\n'),
    );
  });

  it('should_set_the_aria_label_to_the_full_tooltip_content_for_blocked', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.mergeStatus.set({
      state: 'blocked',
      reasons: [{ code: 'need_rebase' }],
    });
    await fixture.whenStable();

    expect(el.querySelector('.status-icon')?.getAttribute('aria-label')).toBe(tooltipOf(fixture));
  });

  it('should_apply_the_configured_tooltip_show_delay', async () => {
    const { fixture } = await setup();

    const tooltip = fixture.debugElement.query(By.directive(MatTooltip)).injector.get(MatTooltip);
    expect(tooltip.showDelay).toBe(300);
  });
});
