import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatTooltip } from '@angular/material/tooltip';
import { provideRouter } from '@angular/router';
import { provideI18nTesting, t } from '../../../core/i18n/testing';
import { provideIcons } from '../../../shared/icons/provide-icons';
import { SyncRun } from '../../../models/sync-status.model';
import { BoardToolbarComponent } from './board-toolbar.component';

function run(overrides: Partial<SyncRun> = {}): SyncRun {
  return {
    startedAt: '2026-09-11T08:00:00.000Z',
    finishedAt: '2026-09-11T08:00:00.000Z',
    status: 'success',
    mrCount: 3,
    errorMessage: null,
    trigger: 'manual',
    ...overrides,
  };
}

@Component({
  imports: [BoardToolbarComponent],
  template: `
    <app-board-toolbar
      [running]="running()"
      [lastRun]="lastRun()"
      [nextRunAt]="nextRunAt()"
      [failureDetail]="failureDetail()"
      [refreshDisabled]="refreshDisabled()"
      [themeIcon]="themeIcon()"
      [themeToggleLabel]="themeToggleLabel()"
      [notificationCount]="notificationCount()"
      [notificationsOpen]="notificationsOpen()"
      (notificationsToggle)="notificationsToggleCount.set(notificationsToggleCount() + 1)"
      (refresh)="refreshCount.set(refreshCount() + 1)"
      (themeToggle)="themeToggleCount.set(themeToggleCount() + 1)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly running = signal(false);
  readonly lastRun = signal<SyncRun | null>(null);
  readonly nextRunAt = signal<string | null>(null);
  readonly notificationCount = signal(0);
  readonly notificationsOpen = signal(false);
  readonly notificationsToggleCount = signal(0);
  readonly failureDetail = signal<string | null>(null);
  readonly refreshDisabled = signal(false);
  readonly refreshCount = signal(0);
  readonly themeIcon = signal<'sun' | 'moon'>('moon');
  readonly themeToggleLabel = signal('Passer en thème sombre');
  readonly themeToggleCount = signal(0);
}

describe('BoardToolbarComponent', () => {
  const setup = async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideRouter([]), provideI18nTesting(), provideIcons()],
    }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  };

  it('should_show_the_app_logo_next_to_the_brand_name', async () => {
    const { el } = await setup();

    const brand = el.querySelector('.nav-brand-group');
    expect(brand?.querySelector('app-logo')).not.toBeNull();
    expect(brand?.querySelector('.nav-brand')?.textContent?.trim()).toBe(t('board.title'));
  });

  it('should_show_never_synced_by_default', async () => {
    const { el } = await setup();

    expect(el.querySelector('.sync-label')?.textContent?.trim()).toBe(t('board.sync.never'));
    expect(el.querySelector('mat-progress-bar')).toBeNull();
  });

  it('should_show_syncing_and_the_progress_bar_while_running', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.running.set(true);
    await fixture.whenStable();

    expect(el.querySelector('.sync-label')?.textContent?.trim()).toBe(t('board.sync.syncing'));
    expect(el.querySelector('.sync-label')?.classList.contains('accent')).toBe(true);
    expect(el.querySelector('mat-progress-bar')).not.toBeNull();
  });

  it('should_show_the_failed_label_in_accent_for_an_error_run', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.lastRun.set(
      run({ status: 'error', finishedAt: new Date(Date.now() - 65_000).toISOString() }),
    );
    await fixture.whenStable();

    expect(el.querySelector('.sync-label')?.textContent?.trim()).toBe(
      t('board.sync.failedMinutesAgo', { minutes: 1 }),
    );
    expect(el.querySelector('.sync-label')?.classList.contains('accent')).toBe(true);
  });

  it('should_disable_the_refresh_button_when_asked', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.refreshDisabled.set(true);
    await fixture.whenStable();

    expect(el.querySelector('button[mat-stroked-button]')?.hasAttribute('disabled')).toBe(true);
  });

  it('should_emit_refresh_on_button_click', async () => {
    const { fixture, el } = await setup();

    el.querySelector<HTMLButtonElement>('button[mat-stroked-button]')?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.refreshCount()).toBe(1);
  });

  it('should_show_the_manual_tooltip_by_default', async () => {
    const { fixture } = await setup();

    const tooltip = fixture.debugElement.query(By.directive(MatTooltip)).injector.get(MatTooltip);
    expect(tooltip.message).toBe(t('board.sync.manualTooltip'));
  });

  it('should_show_the_next_run_time_in_the_tooltip', async () => {
    const { fixture } = await setup();
    const local = new Date(2026, 8, 12, 14, 5);
    fixture.componentInstance.nextRunAt.set(local.toISOString());
    await fixture.whenStable();

    const tooltip = fixture.debugElement.query(By.directive(MatTooltip)).injector.get(MatTooltip);
    expect(tooltip.message).toBe(t('board.sync.nextRunTooltip', { time: '14:05' }));
  });

  it('should_show_the_failure_detail_in_the_tooltip_instead_of_the_next_run_time_rg_021_06', async () => {
    const { fixture } = await setup();
    const local = new Date(2026, 8, 12, 14, 5);
    fixture.componentInstance.nextRunAt.set(local.toISOString());
    fixture.componentInstance.failureDetail.set('front-web: Jeton refusé (github.com)');
    await fixture.whenStable();

    const tooltip = fixture.debugElement.query(By.directive(MatTooltip)).injector.get(MatTooltip);
    expect(tooltip.message).toBe('front-web: Jeton refusé (github.com)');
  });

  it('should_link_the_settings_button_to_settings', async () => {
    const { el } = await setup();

    const link = el.querySelector<HTMLAnchorElement>('a[mat-icon-button][href="/settings"]');
    expect(link?.getAttribute('aria-label')).toBe(t('board.toolbar.settings'));
  });

  it('should_link_the_history_button_to_history_before_the_theme_toggle', async () => {
    const { el } = await setup();

    const buttons = Array.from(el.querySelectorAll('[mat-icon-button]'));
    const link = el.querySelector<HTMLAnchorElement>('a[mat-icon-button][href="/history"]');
    expect(link?.getAttribute('aria-label')).toBe(t('board.toolbar.history'));
    expect(buttons.indexOf(link!)).toBeLessThan(buttons.findIndex((b) => b.classList.contains('theme-toggle')));
  });

  it('should_show_the_theme_toggle_icon_and_label_from_inputs', async () => {
    const { fixture, el } = await setup();

    const button = el.querySelector<HTMLButtonElement>('button.theme-toggle');
    expect(button?.getAttribute('aria-label')).toBe('Passer en thème sombre');
    expect(button?.querySelector('mat-icon')?.getAttribute('data-mat-icon-name')).toBe('moon');

    fixture.componentInstance.themeIcon.set('sun');
    fixture.componentInstance.themeToggleLabel.set('Passer en thème clair');
    await fixture.whenStable();

    expect(button?.getAttribute('aria-label')).toBe('Passer en thème clair');
    expect(button?.querySelector('mat-icon')?.getAttribute('data-mat-icon-name')).toBe('sun');
  });

  it('should_emit_theme_toggle_on_button_click', async () => {
    const { fixture, el } = await setup();

    el.querySelector<HTMLButtonElement>('button.theme-toggle')?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.themeToggleCount()).toBe(1);
  });

  describe('cloche de notifications (US-040)', () => {
    const bell = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('button.notifications-button')!;
    const badge = (el: HTMLElement) => el.querySelector('.notifications-button .count');

    it('should_place_the_bell_between_refresh_and_history_rg_040_04', async () => {
      const { el } = await setup();

      const order = Array.from(el.querySelectorAll('button, a')).filter(
        (node) => node.matches('.notifications-button, a[href="/history"]') || node.textContent?.includes(t('board.toolbar.refresh')),
      );
      expect(order[0].textContent).toContain(t('board.toolbar.refresh'));
      expect(order[1]).toBe(bell(el));
      expect(order[2].getAttribute('href')).toBe('/history');
    });

    it('should_hide_the_badge_at_zero', async () => {
      const { el } = await setup();

      expect(badge(el)).toBeNull();
    });

    it('should_show_the_count_and_name_it_for_screen_readers', async () => {
      const { fixture, el } = await setup();

      fixture.componentInstance.notificationCount.set(7);
      await fixture.whenStable();

      expect(badge(el)?.textContent?.trim()).toBe('7');
      expect(bell(el).getAttribute('aria-label')).toBe(t('board.toolbar.notifications', { count: 7 }));
    });

    it('should_cap_the_badge_at_99_plus_rg_040_03', async () => {
      const { fixture, el } = await setup();

      fixture.componentInstance.notificationCount.set(100);
      await fixture.whenStable();

      expect(badge(el)?.textContent?.trim()).toBe('99+');
    });

    it('should_reflect_the_open_state_and_emit_the_toggle', async () => {
      const { fixture, el } = await setup();
      expect(bell(el).getAttribute('aria-expanded')).toBe('false');
      expect(bell(el).classList.contains('open')).toBe(false);

      fixture.componentInstance.notificationsOpen.set(true);
      await fixture.whenStable();
      expect(bell(el).getAttribute('aria-expanded')).toBe('true');
      expect(bell(el).classList.contains('open')).toBe(true);

      bell(el).click();
      expect(fixture.componentInstance.notificationsToggleCount()).toBe(1);
    });
  });
});
