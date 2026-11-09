import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { provideI18nTesting, t } from '../../../core/i18n/testing';
import { HistoryEvent } from '../../../models/history.model';
import { provideIcons } from '../../../shared/icons/provide-icons';
import { NotificationsStore } from '../../../stores/notifications.store';
import { ProjectsStore } from '../../../stores/projects.store';
import { NotificationsPanelComponent } from './notifications-panel.component';

function event(id: number, overrides: Partial<HistoryEvent> = {}): HistoryEvent {
  return {
    id,
    occurredAt: '2026-11-09T10:00:00.000Z',
    type: 'approved',
    status: 'confirmed',
    projectId: 1,
    projectAlias: 'api',
    mrIid: id,
    mrTitle: `MR ${id}`,
    mrWebUrl: `https://gitlab.com/mr/${id}`,
    actor: { username: 'alice', name: 'Alice', avatarUrl: null },
    oldValue: null,
    newValue: null,
    ...overrides,
  };
}

describe('NotificationsPanelComponent', () => {
  let fixture: ComponentFixture<NotificationsPanelComponent>;
  let el: HTMLElement;
  const store = {
    events: signal<HistoryEvent[]>([]),
    count: signal(0),
    loading: signal(false),
    error: signal<string | null>(null),
    load: vi.fn(),
    dismiss: vi.fn(),
    dismissAll: vi.fn(),
  };
  const projects = { projects: signal([{ id: 1, color: null }]), load: vi.fn() };
  const dialogRef = { close: vi.fn() };
  const snackBar = { open: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    store.events.set([]);
    store.count.set(0);
    store.loading.set(false);
    store.error.set(null);
    store.load.mockResolvedValue(undefined);
    store.dismiss.mockResolvedValue(null);
    store.dismissAll.mockResolvedValue(null);
    await TestBed.configureTestingModule({
      imports: [NotificationsPanelComponent],
      providers: [
        provideRouter([{ path: 'history', children: [] }]),
        provideI18nTesting(),
        provideIcons(),
        { provide: NotificationsStore, useValue: store },
        { provide: ProjectsStore, useValue: projects },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(NotificationsPanelComponent);
    el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  const render = async (events: HistoryEvent[], count = events.length) => {
    store.events.set(events);
    store.count.set(count);
    await fixture.whenStable();
  };
  const markAll = () => el.querySelector<HTMLButtonElement>('button.mark-all')!;

  it('should_load_the_notifications_when_opened', () => {
    expect(store.load).toHaveBeenCalledTimes(1);
  });

  it('should_load_the_projects_for_the_tag_colours_when_none_are_loaded', () => {
    expect(projects.load).not.toHaveBeenCalled();
    projects.projects.set([]);

    TestBed.createComponent(NotificationsPanelComponent).detectChanges();

    expect(projects.load).toHaveBeenCalledTimes(1);
    projects.projects.set([{ id: 1, color: null }]);
  });

  it('should_render_one_row_per_event_with_a_dismiss_button_rg_040_02', async () => {
    await render([event(2), event(1)]);

    expect(el.querySelectorAll('app-history-event-row')).toHaveLength(2);
    expect(el.querySelectorAll('button.dismiss')).toHaveLength(2);
    expect(el.querySelector('.badge')?.textContent?.trim()).toBe('2');
  });

  it('should_keep_the_provisional_rendering_of_the_timeline', async () => {
    await render([event(1, { status: 'provisional', actor: null })]);

    expect(el.querySelector('.row.provisional')).not.toBeNull();
  });

  it('should_cap_the_counter_at_99_plus_rg_040_03', async () => {
    await render([event(1)], 250);

    expect(el.querySelector('.badge')?.textContent?.trim()).toBe('99+');
  });

  it('should_show_the_footer_only_when_entries_are_not_listed_rg_040_07', async () => {
    await render([event(1), event(2)], 2);
    expect(el.querySelector('.panel-footer')).toBeNull();

    await render([event(1), event(2)], 120);
    expect(el.querySelector('.panel-footer')?.textContent).toContain(
      t('notifications.footer', { shown: 2, total: 120 }),
    );
  });

  it('should_dismiss_one_entry_from_its_cross', async () => {
    await render([event(5)]);

    el.querySelector<HTMLButtonElement>('button.dismiss')!.click();

    expect(store.dismiss).toHaveBeenCalledWith(5);
    expect(snackBar.open).not.toHaveBeenCalled();
  });

  it('should_toast_when_a_dismissal_fails_rg_040_04', async () => {
    store.dismiss.mockResolvedValue('errors.network');
    await render([event(5)]);

    el.querySelector<HTMLButtonElement>('button.dismiss')!.click();
    await fixture.whenStable();

    expect(snackBar.open).toHaveBeenCalledWith(
      t('notifications.error.markSeen'),
      t('common.ok'),
      expect.any(Object),
    );
  });

  it('should_mark_everything_as_seen_and_toast_on_failure', async () => {
    await render([event(1), event(2)]);
    markAll().click();
    expect(store.dismissAll).toHaveBeenCalledTimes(1);

    store.dismissAll.mockResolvedValue('errors.network');
    markAll().click();
    await fixture.whenStable();
    expect(snackBar.open).toHaveBeenCalledTimes(1);
  });

  it('should_disable_mark_all_as_seen_when_there_is_nothing_to_handle', async () => {
    await render([]);

    expect(markAll().disabled).toBe(true);
  });

  it('should_show_the_empty_state_with_a_link_to_the_notifications_settings', async () => {
    await render([]);

    const empty = el.querySelector('.state.empty')!;
    expect(empty.textContent).toContain(t('notifications.empty.title'));
    expect(empty.querySelector('a')?.getAttribute('href')).toBe('/settings?tab=notifications');
    expect(el.querySelector('.badge')).toBeNull();
  });

  it('should_show_a_progress_bar_while_loading', async () => {
    store.loading.set(true);
    await fixture.whenStable();

    expect(el.querySelector('mat-progress-bar')).not.toBeNull();
    expect(el.querySelector('.state')).toBeNull();
  });

  it('should_show_an_error_with_a_retry_button_when_the_load_fails', async () => {
    store.error.set('errors.network');
    await fixture.whenStable();

    expect(el.querySelector('.state.error')?.textContent).toContain(t('notifications.error.load'));
    el.querySelector<HTMLButtonElement>('button.retry')!.click();
    expect(store.load).toHaveBeenCalledTimes(2);
  });

  it('should_keep_the_listed_entries_when_a_background_refresh_fails', async () => {
    store.error.set('errors.network');
    await render([event(1)]);

    expect(el.querySelector('.state.error')).toBeNull();
    expect(el.querySelectorAll('app-history-event-row')).toHaveLength(1);
  });

  it('should_close_from_the_cross_and_from_the_history_link', async () => {
    await render([event(1)]);

    el.querySelector<HTMLButtonElement>('button.close')!.click();
    el.querySelector<HTMLAnchorElement>('a.history-link')!.click();
    await fixture.whenStable();

    expect(dialogRef.close).toHaveBeenCalledTimes(2);
  });
});
