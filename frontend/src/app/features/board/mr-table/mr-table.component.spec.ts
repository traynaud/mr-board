import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatTooltip } from '@angular/material/tooltip';
import { By } from '@angular/platform-browser';
import { provideI18nTesting, t } from '../../../core/i18n/testing';
import { MergeRequestSort, MergeRequestView, SortKey } from '../../../models/merge-request.model';
import { provideIcons } from '../../../shared/icons/provide-icons';
import { MrTableComponent } from './mr-table.component';

function mergeRequest(overrides: Partial<MergeRequestView> = {}): MergeRequestView {
  return {
    id: 1,
    projectAlias: 'api',
    iid: 7,
    title: 'Refonte facturation',
    webUrl: 'https://gitlab.com/equipe/api/-/merge_requests/7',
    draft: false,
    author: { username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
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
    ...overrides,
  };
}

@Component({
  imports: [MrTableComponent],
  template: `<app-mr-table [rows]="rows()" [sort]="sort()" (sortChange)="lastSortChange = $event" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly rows = signal<MergeRequestView[]>([mergeRequest()]);
  readonly sort = signal<MergeRequestSort>({ key: 'ready', direction: 'asc' });
  lastSortChange: SortKey | null = null;
}

describe('MrTableComponent', () => {
  const setup = async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideI18nTesting(), provideIcons()],
    }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
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
    const tooltip = fixture.debugElement
      .query(By.css('.title-link'))
      .injector.get(MatTooltip);
    expect(tooltip.message).toBe('Refonte facturation');
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
          { username: 'kbenali', name: 'Karim Benali', avatarUrl: null },
          { username: 'lrousseau', name: 'Léa Rousseau', avatarUrl: null },
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
          { username: 'kbenali', name: 'Karim Benali', avatarUrl: null },
          { username: 'lrousseau', name: 'Léa Rousseau', avatarUrl: null },
        ],
      }),
    ]);
    await fixture.whenStable();

    expect(el.querySelector('.extra')?.textContent?.trim()).toBe('+1');
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
      `${t('board.mergeRequests.columns.ready')} ↑`,
    ]);
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
});
