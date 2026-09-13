import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatMenuHarness } from '@angular/material/menu/testing';
import { MatTooltip } from '@angular/material/tooltip';
import { By } from '@angular/platform-browser';
import { provideI18nTesting, t } from '../../../core/i18n/testing';
import { MergeRequestSort, MergeRequestView, SortKey } from '../../../models/merge-request.model';
import { formatDateTime } from '../../../shared/format/format-date';
import { provideIcons } from '../../../shared/icons/provide-icons';
import { DEFAULT_COLUMN_WIDTHS, ResizableColumnKey } from '../../../stores/column-widths.store';
import { MrTableComponent } from './mr-table.component';

function mergeRequest(overrides: Partial<MergeRequestView> = {}): MergeRequestView {
  return {
    id: 1,
    projectAlias: 'api',
    iid: 7,
    title: 'Refonte facturation',
    webUrl: 'https://gitlab.com/equipe/api/-/merge_requests/7',
    draft: false,
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
    readyDays: 6,
    readyLevel: 'red',
    openedDays: 6,
    isMine: false,
    mergeStatus: { state: 'mergeable', reasons: [] },
    ...overrides,
  };
}

@Component({
  imports: [MrTableComponent],
  template: `
    <app-mr-table
      [rows]="rows()"
      [sort]="sort()"
      [showStatus]="showStatus()"
      [showOpened]="showOpened()"
      [columnWidths]="columnWidths()"
      [openInNewTab]="openInNewTab()"
      [highlightMe]="highlightMe()"
      (sortChange)="lastSortChange = $event"
      (toggleStatusColumn)="toggleStatusColumnCount = toggleStatusColumnCount + 1"
      (toggleOpenedColumn)="toggleOpenedColumnCount = toggleOpenedColumnCount + 1"
      (widthChange)="lastWidthChange = $event"
      (resetColumnWidth)="lastResetColumn = $event"
      (resetAllWidths)="resetAllWidthsCount = resetAllWidthsCount + 1"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly rows = signal<MergeRequestView[]>([mergeRequest()]);
  readonly sort = signal<MergeRequestSort>({ key: 'ready', direction: 'asc' });
  readonly showStatus = signal(true);
  readonly showOpened = signal(false);
  readonly columnWidths = signal<Record<ResizableColumnKey, number>>(DEFAULT_COLUMN_WIDTHS);
  readonly openInNewTab = signal(false);
  readonly highlightMe = signal(true);
  lastSortChange: SortKey | null = null;
  toggleStatusColumnCount = 0;
  toggleOpenedColumnCount = 0;
  lastWidthChange: { key: ResizableColumnKey; width: number } | null = null;
  lastResetColumn: ResizableColumnKey | null = null;
  resetAllWidthsCount = 0;
}

describe('MrTableComponent', () => {
  // jsdom n'implémente pas la Pointer Capture API (voir
  // resizable-column.directive.spec.ts) — stubbée ici aussi pour les tests
  // d'intégration du glisser au niveau du tableau.
  beforeEach(() => {
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => true);
    Element.prototype.releasePointerCapture = vi.fn();
  });

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

  it('should_render_one_row_per_merge_request_with_project_title_and_comments', async () => {
    const { el } = await setup();

    expect(el.querySelector('.tag-neutral')?.textContent?.trim()).toBe('api');
    expect(el.querySelector('.title-link')?.textContent?.trim()).toBe('Refonte facturation');
    expect(el.querySelectorAll('tr.mat-mdc-row')).toHaveLength(1);
  });

  it('should_link_the_title_to_web_url_with_rel_noopener_and_a_tooltip', async () => {
    const { fixture, el } = await setup();

    const link = el.querySelector<HTMLAnchorElement>('.title-link');
    expect(link?.getAttribute('href')).toBe('https://gitlab.com/equipe/api/-/merge_requests/7');
    expect(link?.getAttribute('rel')).toBe('noopener');
    expect(link?.getAttribute('target')).toBe('_self');
    const tooltip = fixture.debugElement
      .query(By.css('.title-link'))
      .injector.get(MatTooltip);
    expect(tooltip.message).toBe('Refonte facturation');
  });

  it('should_open_the_title_link_in_a_new_tab_when_open_in_new_tab_is_enabled', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.openInNewTab.set(true);
    await fixture.whenStable();

    const link = el.querySelector<HTMLAnchorElement>('.title-link');
    expect(link?.getAttribute('target')).toBe('_blank');
  });

  it('should_show_a_dash_when_there_is_no_reviewer_or_assignee', async () => {
    const { el } = await setup();

    expect(el.querySelectorAll('.none')).toHaveLength(2);
    expect(el.querySelector('.none')?.textContent?.trim()).toBe(t('board.mergeRequests.none'));
  });

  it('should_show_the_first_reviewer_and_an_extra_count_for_several', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.rows.set([
      mergeRequest({
        reviewers: [
          { username: 'kbenali', name: 'Karim Benali', avatarUrl: null, isMe: false },
          { username: 'lrousseau', name: 'Léa Rousseau', avatarUrl: null, isMe: false },
        ],
      }),
    ]);
    await fixture.whenStable();

    expect(el.querySelector('.extra')?.textContent?.trim()).toBe('+1');
  });

  it('should_show_the_first_assignee_and_an_extra_count_for_several', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.rows.set([
      mergeRequest({
        assignees: [
          { username: 'kbenali', name: 'Karim Benali', avatarUrl: null, isMe: false },
          { username: 'lrousseau', name: 'Léa Rousseau', avatarUrl: null, isMe: false },
        ],
      }),
    ]);
    await fixture.whenStable();

    expect(el.querySelector('.extra')?.textContent?.trim()).toBe('+1');
  });

  it('should_highlight_the_author_avatar_when_they_are_me_and_highlight_me_is_enabled', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.rows.set([
      mergeRequest({ author: { username: 'mdupont', name: 'Marie Dupont', avatarUrl: null, isMe: true } }),
    ]);
    await fixture.whenStable();

    expect(el.querySelector('.avatar')?.classList.contains('highlighted')).toBe(true);
  });

  it('should_not_highlight_the_author_avatar_when_highlight_me_is_disabled', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.highlightMe.set(false);
    fixture.componentInstance.rows.set([
      mergeRequest({ author: { username: 'mdupont', name: 'Marie Dupont', avatarUrl: null, isMe: true } }),
    ]);
    await fixture.whenStable();

    expect(el.querySelector('.avatar')?.classList.contains('highlighted')).toBe(false);
  });

  it('should_promote_me_to_first_position_among_several_reviewers_when_highlight_me_is_enabled', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.rows.set([
      mergeRequest({
        reviewers: [
          { username: 'kbenali', name: 'Karim Benali', avatarUrl: null, isMe: false },
          { username: 'mdupont', name: 'Marie Dupont', avatarUrl: null, isMe: true },
        ],
      }),
    ]);
    await fixture.whenStable();

    const reviewerAvatar = el.querySelectorAll('.user-group .avatar')[0];
    expect(reviewerAvatar.classList.contains('highlighted')).toBe(true);
    expect(el.querySelector('.extra')?.textContent?.trim()).toBe('+1');
  });

  it('should_highlight_both_the_reviewer_and_the_assignee_avatars_on_the_same_row_when_i_hold_both_roles', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.rows.set([
      mergeRequest({
        author: { username: 'kbenali', name: 'Karim Benali', avatarUrl: null, isMe: false },
        reviewers: [{ username: 'mdupont', name: 'Marie Dupont', avatarUrl: null, isMe: true }],
        assignees: [{ username: 'mdupont', name: 'Marie Dupont', avatarUrl: null, isMe: true }],
      }),
    ]);
    await fixture.whenStable();

    const avatars = el.querySelectorAll('.avatar');
    const highlightedCount = Array.from(avatars).filter((avatar) => avatar.classList.contains('highlighted')).length;
    expect(highlightedCount).toBe(2);
    expect(avatars[0].classList.contains('highlighted')).toBe(false);
  });

  it('should_keep_the_gitlab_order_among_reviewers_when_highlight_me_is_disabled', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.highlightMe.set(false);
    fixture.componentInstance.rows.set([
      mergeRequest({
        reviewers: [
          { username: 'kbenali', name: 'Karim Benali', avatarUrl: null, isMe: false },
          { username: 'mdupont', name: 'Marie Dupont', avatarUrl: null, isMe: true },
        ],
      }),
    ]);
    await fixture.whenStable();

    const reviewerAvatar = el.querySelectorAll('.user-group .avatar')[0];
    expect(reviewerAvatar.classList.contains('highlighted')).toBe(false);
  });

  it('should_show_a_check_icon_only_when_approved', async () => {
    const { fixture, el } = await setup();
    expect(el.querySelector('.approved-icon')).toBeNull();

    fixture.componentInstance.rows.set([mergeRequest({ approved: true })]);
    await fixture.whenStable();

    expect(el.querySelector('.approved-icon')).not.toBeNull();
  });

  it('should_render_column_headers', async () => {
    const { el } = await setup();

    const headers = Array.from(el.querySelectorAll('th')).map((th) => th.textContent?.trim());
    expect(headers).toEqual([
      t('board.mergeRequests.columns.project'),
      t('board.mergeRequests.columns.author'),
      t('board.mergeRequests.columns.title'),
      `${t('board.mergeRequests.columns.difficulty')} ↕`,
      '',
      t('board.mergeRequests.columns.reviewer'),
      t('board.mergeRequests.columns.assignee'),
      t('board.mergeRequests.columns.approved'),
      t('board.mergeRequests.columns.status'),
      `${t('board.mergeRequests.columns.ready')} ↑`,
      '',
    ]);
  });

  it('should_show_the_status_column_by_default_and_hide_it_when_showStatus_is_false', async () => {
    const { fixture, el } = await setup();

    expect(
      Array.from(el.querySelectorAll('th')).some(
        (th) => th.textContent?.trim() === t('board.mergeRequests.columns.status'),
      ),
    ).toBe(true);

    fixture.componentInstance.showStatus.set(false);
    await fixture.whenStable();

    expect(
      Array.from(el.querySelectorAll('th')).some(
        (th) => th.textContent?.trim() === t('board.mergeRequests.columns.status'),
      ),
    ).toBe(false);
  });

  it('should_render_the_merge_status_icon_for_each_row', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.rows.set([
      mergeRequest({ mergeStatus: { state: 'blocked', reasons: [{ code: 'conflicts' }] } }),
    ]);
    await fixture.whenStable();

    expect(el.querySelector('app-merge-status-icon .danger')).not.toBeNull();
  });

  it('should_hide_the_opened_column_by_default_and_show_it_when_showOpened_is_true', async () => {
    const { fixture, el } = await setup();

    expect(
      Array.from(el.querySelectorAll('th')).some(
        (th) => th.textContent?.trim() === t('board.mergeRequests.columns.opened'),
      ),
    ).toBe(false);

    fixture.componentInstance.showOpened.set(true);
    await fixture.whenStable();

    const headers = Array.from(el.querySelectorAll('th')).map((th) => th.textContent?.trim());
    expect(headers).toContain(t('board.mergeRequests.columns.opened'));
    expect(headers.at(-2)).toBe(t('board.mergeRequests.columns.opened'));
  });

  it('should_show_the_created_date_in_the_opened_column', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.showOpened.set(true);
    fixture.componentInstance.rows.set([mergeRequest({ createdAt: '2026-09-01T10:00:00.000Z' })]);
    await fixture.whenStable();

    expect(el.querySelector('.opened-cell')?.textContent?.trim()).toBe('01/09/2026');
  });

  describe('columns menu', () => {
    function menuOptions(): HTMLElement[] {
      return Array.from(document.querySelectorAll<HTMLElement>('.menu-option'));
    }

    it('should_list_the_status_option_before_the_opened_option', async () => {
      const { loader } = await setup();
      const menu = await loader.getHarness(MatMenuHarness);
      await menu.open();

      const labels = menuOptions().map((option) => option.querySelector('.option-label')?.textContent?.trim());
      expect(labels).toEqual([t('board.columns.status'), t('board.columns.opened')]);
    });

    it('should_show_the_status_checkbox_reflecting_showStatus', async () => {
      const { fixture, loader } = await setup();
      fixture.componentInstance.showStatus.set(false);
      await fixture.whenStable();

      const menu = await loader.getHarness(MatMenuHarness);
      await menu.open();

      expect(menuOptions()[0].getAttribute('aria-checked')).toBe('false');
    });

    it('should_show_the_opened_checkbox_reflecting_showOpened', async () => {
      const { fixture, loader } = await setup();
      fixture.componentInstance.showOpened.set(true);
      await fixture.whenStable();

      const menu = await loader.getHarness(MatMenuHarness);
      await menu.open();

      expect(menuOptions()[1].getAttribute('aria-checked')).toBe('true');
    });

    it('should_emit_toggleStatusColumn_and_keep_the_menu_open_when_the_status_option_is_clicked', async () => {
      const { fixture, loader } = await setup();
      const menu = await loader.getHarness(MatMenuHarness);
      await menu.open();

      menuOptions()[0].click();
      await fixture.whenStable();

      expect(fixture.componentInstance.toggleStatusColumnCount).toBe(1);
      expect(fixture.componentInstance.toggleOpenedColumnCount).toBe(0);
      expect(await menu.isOpen()).toBe(true);
    });

    it('should_emit_toggleOpenedColumn_and_keep_the_menu_open_when_the_opened_option_is_clicked', async () => {
      const { fixture, loader } = await setup();
      const menu = await loader.getHarness(MatMenuHarness);
      await menu.open();

      menuOptions()[1].click();
      await fixture.whenStable();

      expect(fixture.componentInstance.toggleOpenedColumnCount).toBe(1);
      expect(fixture.componentInstance.toggleStatusColumnCount).toBe(0);
      expect(await menu.isOpen()).toBe(true);
    });
  });

  it('should_mark_the_active_sort_column_with_an_arrow_accent_color_and_aria_sort', async () => {
    const { el } = await setup();

    const readyHeader = Array.from(el.querySelectorAll('th')).find((th) =>
      th.textContent?.includes(t('board.mergeRequests.columns.ready')),
    );
    const diffHeader = Array.from(el.querySelectorAll('th')).find((th) =>
      th.textContent?.includes(t('board.mergeRequests.columns.difficulty')),
    );

    expect(readyHeader?.classList.contains('active')).toBe(true);
    expect(readyHeader?.getAttribute('aria-sort')).toBe('ascending');
    expect(diffHeader?.classList.contains('active')).toBe(false);
    expect(diffHeader?.getAttribute('aria-sort')).toBeNull();
  });

  it('should_show_the_descending_arrow_when_the_active_column_is_desc', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.sort.set({ key: 'ready', direction: 'desc' });
    await fixture.whenStable();

    const readyHeader = Array.from(el.querySelectorAll('th')).find((th) =>
      th.textContent?.includes(t('board.mergeRequests.columns.ready')),
    );
    expect(readyHeader?.textContent?.trim().endsWith('↓')).toBe(true);
    expect(readyHeader?.getAttribute('aria-sort')).toBe('descending');
  });

  it('should_emit_sort_change_on_click_of_a_sortable_header', async () => {
    const { fixture, el } = await setup();
    const diffHeader = Array.from(el.querySelectorAll('th')).find((th) =>
      th.textContent?.includes(t('board.mergeRequests.columns.difficulty')),
    );

    diffHeader?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await fixture.whenStable();

    expect(fixture.componentInstance.lastSortChange).toBe('diff');
  });

  it('should_emit_sort_change_on_enter_keydown_of_a_sortable_header', async () => {
    const { fixture, el } = await setup();
    const readyHeader = Array.from(el.querySelectorAll('th')).find((th) =>
      th.textContent?.includes(t('board.mergeRequests.columns.ready')),
    );

    readyHeader?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await fixture.whenStable();

    expect(fixture.componentInstance.lastSortChange).toBe('ready');
  });

  it('should_emit_sort_change_and_prevent_scroll_on_space_keydown_of_a_sortable_header', async () => {
    const { fixture, el } = await setup();
    const diffHeader = Array.from(el.querySelectorAll('th')).find((th) =>
      th.textContent?.includes(t('board.mergeRequests.columns.difficulty')),
    );
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    diffHeader?.dispatchEvent(event);
    await fixture.whenStable();

    expect(fixture.componentInstance.lastSortChange).toBe('diff');
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('should_emit_sort_change_on_space_keydown_of_the_ready_header', async () => {
    const { fixture, el } = await setup();
    const readyHeader = Array.from(el.querySelectorAll('th')).find((th) =>
      th.textContent?.includes(t('board.mergeRequests.columns.ready')),
    );

    readyHeader?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    await fixture.whenStable();

    expect(fixture.componentInstance.lastSortChange).toBe('ready');
  });

  it('should_not_be_clickable_or_marked_sortable_for_a_non_sortable_header', async () => {
    const { el } = await setup();

    const authorHeader = Array.from(el.querySelectorAll('th')).find((th) =>
      th.textContent?.trim() === t('board.mergeRequests.columns.author'),
    );

    expect(authorHeader?.classList.contains('sortable')).toBe(false);
    expect(authorHeader?.getAttribute('tabindex')).toBeNull();
  });

  it('should_render_the_difficulty_badge_for_each_row', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.rows.set([
      mergeRequest({
        difficulty: 'hard',
        changedFiles: 34,
        additions: 900,
        deletions: 340,
        changedLines: 1240,
      }),
    ]);
    await fixture.whenStable();

    const badge = el.querySelector('app-difficulty-badge');
    expect(badge?.querySelector('.square')?.classList.contains('hard')).toBe(true);
    expect(badge?.querySelector('.meta')?.textContent?.trim()).toBe('34 f · 1240 l');
  });

  it('should_render_the_ready_delay_for_each_row', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.rows.set([
      mergeRequest({ readyDays: 6, readyLevel: 'red' }),
    ]);
    await fixture.whenStable();

    const readyDelay = el.querySelector('app-ready-delay');
    expect(readyDelay?.querySelector('.ready')?.classList.contains('red')).toBe(true);
  });

  it('should_render_the_opened_label_for_a_draft_row', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.rows.set([
      mergeRequest({
        draft: true,
        readyAt: null,
        readyDays: null,
        readyLevel: null,
        openedDays: 12,
      }),
    ]);
    await fixture.whenStable();

    const readyDelay = el.querySelector('app-ready-delay');
    expect(readyDelay?.querySelector('.opened')).not.toBeNull();
    expect(readyDelay?.querySelector('.ready')).toBeNull();
  });

  describe('column resizing (US-012)', () => {
    it('should_apply_the_column_width_to_each_resizable_header', async () => {
      const { fixture, el } = await setup();
      fixture.componentInstance.columnWidths.set({
        ...DEFAULT_COLUMN_WIDTHS,
        project: 120,
      });
      await fixture.whenStable();

      const projectHeader = Array.from(el.querySelectorAll('th')).find((th) =>
        th.textContent?.includes(t('board.mergeRequests.columns.project')),
      );
      expect(projectHeader?.style.width).toBe('120px');
    });

    it('should_not_set_a_width_on_the_title_header', async () => {
      const { el } = await setup();

      const titleHeader = Array.from(el.querySelectorAll('th')).find(
        (th) => th.textContent?.trim() === t('board.mergeRequests.columns.title'),
      );
      expect(titleHeader?.style.width).toBe('');
    });

    it('should_set_an_aria_label_naming_the_column_on_each_resize_handle', async () => {
      const { el } = await setup();

      const projectHandle = el.querySelector('[appResizableColumn]');
      expect(projectHandle?.getAttribute('aria-label')).toBe(
        t('board.columns.resizeAriaLabel', { name: t('board.mergeRequests.columns.project') }),
      );
    });

    it('should_emit_widthChange_with_the_column_key_while_dragging_its_handle', async () => {
      const { fixture, el } = await setup();
      const authorHandle = Array.from(el.querySelectorAll('[appResizableColumn]')).find((handle) =>
        handle.getAttribute('aria-label')?.includes(t('board.mergeRequests.columns.author')),
      ) as HTMLElement;

      authorHandle.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, pointerId: 1, bubbles: true }));
      authorHandle.dispatchEvent(new PointerEvent('pointermove', { clientX: 130, pointerId: 1, bubbles: true }));
      await fixture.whenStable();

      expect(fixture.componentInstance.lastWidthChange).toEqual({
        key: 'author',
        width: DEFAULT_COLUMN_WIDTHS.author + 30,
      });
    });

    it('should_emit_resetColumnWidth_with_the_column_key_on_double_click', async () => {
      const { fixture, el } = await setup();
      const projectHandle = el.querySelector<HTMLElement>('[appResizableColumn]');

      projectHandle?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await fixture.whenStable();

      expect(fixture.componentInstance.lastResetColumn).toBe('project');
    });

    it('should_not_trigger_sort_when_the_resize_handle_of_a_sortable_column_is_clicked', async () => {
      const { fixture, el } = await setup();
      const diffHeader = Array.from(el.querySelectorAll('th')).find((th) =>
        th.textContent?.includes(t('board.mergeRequests.columns.difficulty')),
      );
      const diffHandle = diffHeader?.querySelector<HTMLElement>('[appResizableColumn]');

      diffHandle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await fixture.whenStable();

      expect(fixture.componentInstance.lastSortChange).toBeNull();
    });

    it('should_show_a_tooltip_with_the_exact_date_and_time_on_the_opened_column', async () => {
      const { fixture } = await setup();
      fixture.componentInstance.showOpened.set(true);
      fixture.componentInstance.rows.set([
        mergeRequest({ createdAt: '2026-09-01T14:30:00.000Z' }),
      ]);
      await fixture.whenStable();

      const cell = fixture.debugElement.query(By.css('.opened-cell')).injector.get(MatTooltip);
      expect(cell.message).toBe(
        t('board.mergeRequests.opened.tooltip', {
          date: formatDateTime('2026-09-01T14:30:00.000Z'),
        }),
      );
    });

    it('should_show_a_reset_all_widths_item_in_the_columns_menu', async () => {
      const { loader } = await setup();
      const menu = await loader.getHarness(MatMenuHarness);
      await menu.open();
      const items = await menu.getItems();

      expect(await items[0].getText()).toBe(t('board.columns.resetWidths'));
    });

    it('should_emit_resetAllWidths_when_the_menu_item_is_clicked', async () => {
      const { fixture, loader } = await setup();
      const menu = await loader.getHarness(MatMenuHarness);
      await menu.open();
      const items = await menu.getItems();

      await items[0].click();

      expect(fixture.componentInstance.resetAllWidthsCount).toBe(1);
    });
  });
});
