import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatMenuHarness } from '@angular/material/menu/testing';
import { MatTooltip } from '@angular/material/tooltip';
import { By } from '@angular/platform-browser';
import { provideI18nTesting, t } from '../../../core/i18n/testing';
import { MergeRequestSort, MergeRequestView, SortKey } from '../../../models/merge-request.model';
import { Project } from '../../../models/project.model';
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
    labels: [],
    author: { username: 'mdupont', name: 'Marie Dupont', avatarUrl: null, isMe: false },
    reviewers: [],
    assignees: [],
    approved: false,
    approvedBy: [],
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
    isFavorite: false,
    mergeStatus: { state: 'mergeable', reasons: [] },
    connection: { id: 1, name: 'GitLab', type: 'gitlab' },
    ...overrides,
  };
}

@Component({
  imports: [MrTableComponent],
  template: `
    <app-mr-table
      [rows]="rows()"
      [projects]="projects()"
      [showForgeIcon]="showForgeIcon()"
      [showConnectionInTooltip]="showConnectionInTooltip()"
      [sort]="sort()"
      [showStatus]="showStatus()"
      [showOpened]="showOpened()"
      [showLabels]="showLabels()"
      [columnWidths]="columnWidths()"
      [openInNewTab]="openInNewTab()"
      [highlightMe]="highlightMe()"
      (sortChange)="lastSortChange = $event"
      (toggleStatusColumn)="toggleStatusColumnCount = toggleStatusColumnCount + 1"
      (toggleOpenedColumn)="toggleOpenedColumnCount = toggleOpenedColumnCount + 1"
      (toggleLabelsColumn)="toggleLabelsColumnCount = toggleLabelsColumnCount + 1"
      (widthChange)="lastWidthChange = $event"
      (resetColumnWidth)="lastResetColumn = $event"
      (resetAllWidths)="resetAllWidthsCount = resetAllWidthsCount + 1"
      (favoriteToggle)="lastFavoriteToggle = $event"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly rows = signal<MergeRequestView[]>([mergeRequest()]);
  readonly projects = signal<Project[]>([
    {
      id: 1,
      connectionId: 1,
      pathWithNamespace: 'equipe/backend-api',
      alias: 'api',
      remoteProjectId: '42',
      color: null,
    },
  ]);
  readonly showForgeIcon = signal(false);
  readonly showConnectionInTooltip = signal(false);
  readonly sort = signal<MergeRequestSort>({ key: 'ready', direction: 'asc' });
  readonly showStatus = signal(true);
  readonly showOpened = signal(false);
  readonly showLabels = signal(false);
  readonly columnWidths = signal<Record<ResizableColumnKey, number>>(DEFAULT_COLUMN_WIDTHS);
  readonly openInNewTab = signal(false);
  readonly highlightMe = signal(true);
  lastSortChange: SortKey | null = null;
  toggleStatusColumnCount = 0;
  toggleOpenedColumnCount = 0;
  toggleLabelsColumnCount = 0;
  lastWidthChange: { key: ResizableColumnKey; width: number } | null = null;
  lastResetColumn: ResizableColumnKey | null = null;
  resetAllWidthsCount = 0;
  lastFavoriteToggle: MergeRequestView | null = null;
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

  describe('forge icon and tooltip on the project tag (RG-021-01/02)', () => {
    it('should_not_show_a_forge_icon_by_default_with_a_single_forge_type', async () => {
      const { el } = await setup();

      expect(el.querySelector('.tag-neutral mat-icon.forge-icon')).toBeNull();
      expect(el.querySelector('.tag-neutral')?.textContent?.trim()).toBe('api');
    });

    it('should_show_the_gitlab_icon_before_the_alias_when_showForgeIcon_is_enabled_rg_021_01', async () => {
      const { fixture, el } = await setup();
      fixture.componentInstance.showForgeIcon.set(true);
      await fixture.whenStable();

      const icon = el.querySelector<HTMLElement>('.tag-neutral mat-icon.forge-icon');
      expect(icon?.getAttribute('data-mat-icon-name')).toBe('gitlab');
    });

    it('should_show_the_github_icon_for_a_row_whose_connection_is_github_rg_021_01', async () => {
      const { fixture, el } = await setup();
      fixture.componentInstance.rows.set([
        mergeRequest({ connection: { id: 2, name: 'github.com', type: 'github' } }),
      ]);
      fixture.componentInstance.showForgeIcon.set(true);
      await fixture.whenStable();

      const icon = el.querySelector<HTMLElement>('.tag-neutral mat-icon.forge-icon');
      expect(icon?.getAttribute('data-mat-icon-name')).toBe('github');
    });

    it('should_show_only_the_path_in_the_tooltip_with_a_single_connection_rg_021_02', async () => {
      const { fixture } = await setup();

      const tooltip = fixture.debugElement.query(By.css('.tag-neutral')).injector.get(MatTooltip);
      expect(tooltip.message).toBe('equipe/backend-api');
    });

    it('should_prefix_the_tooltip_with_the_connection_name_when_showConnectionInTooltip_is_enabled_rg_021_02', async () => {
      const { fixture } = await setup();
      fixture.componentInstance.showConnectionInTooltip.set(true);
      await fixture.whenStable();

      const tooltip = fixture.debugElement.query(By.css('.tag-neutral')).injector.get(MatTooltip);
      expect(tooltip.message).toBe('GitLab · equipe/backend-api');
    });
  });

  describe('project tag color (RG-025-03/04/06)', () => {
    it('should_keep_tag_neutral_when_the_repo_has_no_color_rg_025_01', async () => {
      const { el } = await setup();

      const tag = el.querySelector<HTMLElement>('.tag');
      expect(tag?.classList.contains('tag-neutral')).toBe(true);
      expect(tag?.style.backgroundColor).toBe('');
    });

    it('should_show_the_full_color_for_a_ready_mr_rg_025_03', async () => {
      const { fixture, el } = await setup();
      fixture.componentInstance.projects.set([
        {
          id: 1,
          connectionId: 1,
          pathWithNamespace: 'equipe/backend-api',
          alias: 'api',
          remoteProjectId: '42',
          color: 'sage',
        },
      ]);
      fixture.componentInstance.rows.set([mergeRequest({ draft: false })]);
      await fixture.whenStable();

      const tag = el.querySelector<HTMLElement>('.tag');
      expect(tag?.classList.contains('tag-neutral')).toBe(false);
      expect(tag?.style.backgroundColor).toBe('rgb(200, 221, 199)');
      expect(tag?.style.color).toBe('rgb(37, 56, 31)');
    });

    it('should_lighten_the_color_for_a_draft_mr_rg_025_04', async () => {
      const { fixture, el } = await setup();
      fixture.componentInstance.projects.set([
        {
          id: 1,
          connectionId: 1,
          pathWithNamespace: 'equipe/backend-api',
          alias: 'api',
          remoteProjectId: '42',
          color: 'sage',
        },
      ]);
      fixture.componentInstance.rows.set([mergeRequest({ draft: true })]);
      await fixture.whenStable();

      const tag = el.querySelector<HTMLElement>('.tag');
      expect(tag?.style.backgroundColor).toBe('rgba(200, 221, 199, 0.45)');
      expect(tag?.style.color).toBe('rgb(37, 56, 31)');
    });

    it('should_resolve_the_color_by_the_rows_own_project_alias_rg_025_06', async () => {
      const { fixture, el } = await setup();
      fixture.componentInstance.projects.set([
        {
          id: 1,
          connectionId: 1,
          pathWithNamespace: 'equipe/backend-api',
          alias: 'api',
          remoteProjectId: '42',
          color: 'sage',
        },
        {
          id: 2,
          connectionId: 1,
          pathWithNamespace: 'equipe/front-web',
          alias: 'web',
          remoteProjectId: '7',
          color: 'slate',
        },
      ]);
      fixture.componentInstance.rows.set([
        mergeRequest({ id: 1, projectAlias: 'web', draft: false }),
      ]);
      await fixture.whenStable();

      const tag = el.querySelector<HTMLElement>('.tag');
      expect(tag?.style.backgroundColor).toBe('rgb(199, 217, 234)');
    });

    it('should_update_every_row_of_the_same_repo_when_its_color_changes', async () => {
      const { fixture, el } = await setup();
      fixture.componentInstance.rows.set([
        mergeRequest({ id: 1, projectAlias: 'api', draft: false }),
        mergeRequest({ id: 2, projectAlias: 'api', draft: false }),
      ]);
      await fixture.whenStable();

      fixture.componentInstance.projects.set([
        {
          id: 1,
          connectionId: 1,
          pathWithNamespace: 'equipe/backend-api',
          alias: 'api',
          remoteProjectId: '42',
          color: 'peach',
        },
      ]);
      await fixture.whenStable();

      const tags = el.querySelectorAll<HTMLElement>('.tag');
      expect(tags).toHaveLength(2);
      for (const tag of Array.from(tags)) {
        expect(tag.style.backgroundColor).toBe('rgb(240, 217, 196)');
      }
    });
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

  describe('approved column tooltip (RG-029-02)', () => {
    it('should_show_the_name_of_the_single_approver', async () => {
      const { fixture } = await setup();
      fixture.componentInstance.rows.set([
        mergeRequest({
          approved: true,
          approvedBy: [
            { username: 'kbenali', name: 'Karim Benali', avatarUrl: null, isMe: false },
          ],
        }),
      ]);
      await fixture.whenStable();

      const tooltip = fixture.debugElement
        .query(By.css('.approved-icon'))
        .injector.get(MatTooltip);
      expect(tooltip.message).toBe('Karim Benali');
    });

    it('should_list_every_approver_name_separated_by_a_comma_when_several_approved', async () => {
      const { fixture } = await setup();
      fixture.componentInstance.rows.set([
        mergeRequest({
          approved: true,
          approvedBy: [
            { username: 'kbenali', name: 'Karim Benali', avatarUrl: null, isMe: false },
            { username: 'lrousseau', name: 'Léa Rousseau', avatarUrl: null, isMe: false },
          ],
        }),
      ]);
      await fixture.whenStable();

      const tooltip = fixture.debugElement
        .query(By.css('.approved-icon'))
        .injector.get(MatTooltip);
      expect(tooltip.message).toBe('Karim Benali, Léa Rousseau');
    });

    it('should_show_no_tooltip_when_approved_but_not_yet_resynced_since_this_us_rg_029_04', async () => {
      const { fixture } = await setup();
      fixture.componentInstance.rows.set([
        mergeRequest({ approved: true, approvedBy: [] }),
      ]);
      await fixture.whenStable();

      const tooltip = fixture.debugElement
        .query(By.css('.approved-icon'))
        .injector.get(MatTooltip);
      expect(tooltip.message).toBe('');
    });
  });

  describe('favorite column (RG-027-07/08/09)', () => {
    it('should_apply_material_icon_button_styling_to_the_favorite_toggle', async () => {
      // Bug : `MatButtonModule` n'était pas importé, donc `mat-icon-button`
      // ne s'activait jamais — le bouton restait un <button> natif non
      // stylé (fond + bordure du navigateur visibles comme un carré autour
      // de l'étoile) au lieu du bouton Material transparent attendu.
      const { el } = await setup();

      const button = el.querySelector<HTMLButtonElement>('.favorite-toggle');
      expect(button?.classList.contains('mat-mdc-icon-button')).toBe(true);
    });

    it('should_show_the_outline_star_for_a_non_favorite_row', async () => {
      const { el } = await setup();

      const icon = el.querySelector<HTMLElement>('.favorite-icon');
      expect(icon?.getAttribute('data-mat-icon-name')).toBe('star');
      expect(icon?.classList.contains('active')).toBe(false);
    });

    it('should_show_the_filled_star_for_a_favorite_row', async () => {
      const { fixture, el } = await setup();
      fixture.componentInstance.rows.set([mergeRequest({ isFavorite: true })]);
      await fixture.whenStable();

      const icon = el.querySelector<HTMLElement>('.favorite-icon');
      expect(icon?.getAttribute('data-mat-icon-name')).toBe('star-fill');
      expect(icon?.classList.contains('active')).toBe(true);
    });

    it('should_emit_favorite_toggle_with_the_row_when_the_button_is_clicked', async () => {
      const { fixture, el } = await setup();

      el.querySelector<HTMLButtonElement>('.favorite-toggle')?.click();

      expect(fixture.componentInstance.lastFavoriteToggle?.id).toBe(1);
    });

    it('should_expose_a_translated_aria_label_naming_the_title_and_current_state', async () => {
      const { fixture, el } = await setup();
      fixture.componentInstance.rows.set([mergeRequest({ title: 'Refonte facturation' })]);
      await fixture.whenStable();

      const button = el.querySelector<HTMLButtonElement>('.favorite-toggle');
      expect(button?.getAttribute('aria-label')).toBe(
        t('board.mergeRequests.favorite.add', { title: 'Refonte facturation' }),
      );

      fixture.componentInstance.rows.set([
        mergeRequest({ title: 'Refonte facturation', isFavorite: true }),
      ]);
      await fixture.whenStable();

      expect(el.querySelector('.favorite-toggle')?.getAttribute('aria-label')).toBe(
        t('board.mergeRequests.favorite.remove', { title: 'Refonte facturation' }),
      );
    });

    it('should_render_the_favorite_column_before_project_rg_027_07', async () => {
      const { el } = await setup();

      const headerCells = Array.from(el.querySelectorAll('th'));
      expect(headerCells[0].classList.contains('favorite-header')).toBe(true);
    });
  });

  it('should_render_column_headers', async () => {
    const { el } = await setup();

    const headers = Array.from(el.querySelectorAll('th')).map((th) => th.textContent?.trim());
    expect(headers).toEqual([
      '',
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

  it('should_pass_the_rows_own_connection_type_to_the_merge_status_icon', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.rows.set([
      mergeRequest({
        mergeStatus: { state: 'unknown', reasons: [] },
        connection: { id: 2, name: 'github.com', type: 'github' },
      }),
    ]);
    await fixture.whenStable();

    expect(el.querySelector('app-merge-status-icon .status-icon')?.getAttribute('aria-label')).toBe(
      t('board.mergeRequests.mergeStatus.unknown', { forge: t('settings.connections.form.typeGithub') }),
    );
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

  it('should_show_the_created_date_in_iso_format_when_the_language_is_english', async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideI18nTesting('en'), provideIcons()],
    }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    fixture.componentInstance.showOpened.set(true);
    fixture.componentInstance.rows.set([mergeRequest({ createdAt: '2026-09-01T10:00:00.000Z' })]);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.opened-cell')?.textContent?.trim()).toBe('2026-09-01');
  });

  describe('labels column (RG-028-05/06)', () => {
    it('should_hide_the_labels_column_by_default_and_show_it_when_showLabels_is_true', async () => {
      const { fixture, el } = await setup();

      expect(
        Array.from(el.querySelectorAll('th')).some(
          (th) => th.textContent?.trim() === t('board.mergeRequests.columns.labels'),
        ),
      ).toBe(false);

      fixture.componentInstance.showLabels.set(true);
      await fixture.whenStable();

      const headers = Array.from(el.querySelectorAll('th')).map((th) => th.textContent?.trim());
      expect(headers).toContain(t('board.mergeRequests.columns.labels'));
    });

    it('should_show_a_dash_when_the_row_has_no_label', async () => {
      const { fixture, el } = await setup();
      fixture.componentInstance.showLabels.set(true);
      fixture.componentInstance.rows.set([mergeRequest({ labels: [] })]);
      await fixture.whenStable();

      expect(el.querySelector('.label-group')).toBeNull();
      expect(
        Array.from(el.querySelectorAll('.none')).some((none) => none.textContent?.trim() === t('board.mergeRequests.none')),
      ).toBe(true);
    });

    it('should_show_up_to_2_labels_as_tags', async () => {
      const { fixture, el } = await setup();
      fixture.componentInstance.showLabels.set(true);
      fixture.componentInstance.rows.set([mergeRequest({ labels: ['bug', 'urgent'] })]);
      await fixture.whenStable();

      const group = el.querySelector('.label-group');
      const tags = Array.from(group?.querySelectorAll('.tag') ?? []).map((tag) => tag.textContent?.trim());
      expect(tags).toEqual(['bug', 'urgent']);
      expect(group?.querySelector('.extra')).toBeNull();
    });

    it('should_truncate_beyond_2_labels_with_an_extra_count_and_a_full_tooltip', async () => {
      const { fixture, el } = await setup();
      fixture.componentInstance.showLabels.set(true);
      fixture.componentInstance.rows.set([
        mergeRequest({ labels: ['bug', 'urgent', 'backend'] }),
      ]);
      await fixture.whenStable();

      const group = el.querySelector<HTMLElement>('.label-group');
      const tags = Array.from(group?.querySelectorAll('.tag') ?? []).map((tag) => tag.textContent?.trim());
      expect(tags).toEqual(['bug', 'urgent']);
      expect(group?.querySelector('.extra')?.textContent?.trim()).toBe('+1');
    });
  });

  describe('columns menu', () => {
    function menuOptions(): HTMLElement[] {
      return Array.from(document.querySelectorAll<HTMLElement>('.menu-option'));
    }

    it('should_list_the_status_opened_and_labels_options_in_order', async () => {
      const { loader } = await setup();
      const menu = await loader.getHarness(MatMenuHarness);
      await menu.open();

      const labels = menuOptions().map((option) => option.querySelector('.option-label')?.textContent?.trim());
      expect(labels).toEqual([
        t('board.columns.status'),
        t('board.columns.opened'),
        t('board.columns.labels'),
      ]);
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

    it('should_show_the_labels_checkbox_reflecting_showLabels_rg_028_05', async () => {
      const { fixture, loader } = await setup();
      fixture.componentInstance.showLabels.set(true);
      await fixture.whenStable();

      const menu = await loader.getHarness(MatMenuHarness);
      await menu.open();

      expect(menuOptions()[2].getAttribute('aria-checked')).toBe('true');
    });

    it('should_emit_toggleLabelsColumn_and_keep_the_menu_open_when_the_labels_option_is_clicked_rg_028_05', async () => {
      const { fixture, loader } = await setup();
      const menu = await loader.getHarness(MatMenuHarness);
      await menu.open();

      menuOptions()[2].click();
      await fixture.whenStable();

      expect(fixture.componentInstance.toggleLabelsColumnCount).toBe(1);
      expect(fixture.componentInstance.toggleStatusColumnCount).toBe(0);
      expect(fixture.componentInstance.toggleOpenedColumnCount).toBe(0);
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
