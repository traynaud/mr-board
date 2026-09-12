import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatTooltip } from '@angular/material/tooltip';
import { By } from '@angular/platform-browser';
import { provideI18nTesting, t } from '../../../core/i18n/testing';
import { MergeRequestView } from '../../../models/merge-request.model';
import { provideIcons } from '../../../shared/icons/provide-icons';
import { MrTableComponent } from './mr-table.component';

function mergeRequest(overrides: Partial<MergeRequestView> = {}): MergeRequestView {
  return {
    id: 1,
    projectAlias: 'api',
    iid: 7,
    title: 'Refonte facturation',
    webUrl: 'https://gitlab.com/equipe/api/-/merge_requests/7',
    author: { username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
    reviewers: [],
    assignees: [],
    approved: false,
    commentsCount: 0,
    ...overrides,
  };
}

@Component({
  imports: [MrTableComponent],
  template: `<app-mr-table [rows]="rows()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly rows = signal<MergeRequestView[]>([mergeRequest()]);
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
      '',
      t('board.mergeRequests.columns.reviewer'),
      t('board.mergeRequests.columns.assignee'),
      t('board.mergeRequests.columns.approved'),
    ]);
  });
});
