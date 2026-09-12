import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatChipListboxHarness, MatChipOptionHarness } from '@angular/material/chips/testing';
import { MatTooltip } from '@angular/material/tooltip';
import { By } from '@angular/platform-browser';
import { provideI18nTesting, t } from '../../../core/i18n/testing';
import { MergeRequestView } from '../../../models/merge-request.model';
import { provideIcons } from '../../../shared/icons/provide-icons';
import { FilterBarComponent } from './filter-bar.component';

function mr(overrides: Partial<MergeRequestView> = {}): MergeRequestView {
  return {
    id: 1,
    projectAlias: 'api',
    iid: 1,
    title: 'Title',
    webUrl: 'https://gitlab.com/equipe/api/-/merge_requests/1',
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
    readyDays: 1,
    readyLevel: 'green',
    openedDays: 1,
    isMine: false,
    ...overrides,
  };
}

@Component({
  imports: [FilterBarComponent],
  template: `
    <app-filter-bar
      [drafts]="drafts()"
      [mine]="mine()"
      [identityConfigured]="identityConfigured()"
      [rows]="rows()"
      (draftsToggle)="draftsToggleCount = draftsToggleCount + 1"
      (mineToggle)="mineToggleCount = mineToggleCount + 1"
      (clearFilters)="clearCount = clearCount + 1"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly drafts = signal(false);
  readonly mine = signal(false);
  readonly identityConfigured = signal(true);
  readonly rows = signal<MergeRequestView[]>([mr({ id: 1 }), mr({ id: 2, projectAlias: 'web' })]);
  draftsToggleCount = 0;
  mineToggleCount = 0;
  clearCount = 0;
}

describe('FilterBarComponent', () => {
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

  it('should_render_the_drafts_and_mine_chips', async () => {
    const { loader } = await setup();
    const listbox = await loader.getHarness(MatChipListboxHarness);
    const chips = await listbox.getChips();

    expect(chips).toHaveLength(2);
    expect(await chips[0].getText()).toBe(t('board.filters.drafts'));
    expect(await chips[1].getText()).toBe(t('board.filters.mine'));
  });

  it('should_reflect_the_drafts_and_mine_selected_state', async () => {
    const { fixture, loader } = await setup();
    fixture.componentInstance.drafts.set(true);
    await fixture.whenStable();

    const draftsChip = await loader.getHarness(
      MatChipOptionHarness.with({ text: t('board.filters.drafts') }),
    );
    expect(await draftsChip.isSelected()).toBe(true);

    const mineChip = await loader.getHarness(
      MatChipOptionHarness.with({ text: t('board.filters.mine') }),
    );
    expect(await mineChip.isSelected()).toBe(false);
  });

  it('should_emit_drafts_toggle_when_the_drafts_chip_is_clicked', async () => {
    const { fixture, loader } = await setup();
    const draftsChip = await loader.getHarness(
      MatChipOptionHarness.with({ text: t('board.filters.drafts') }),
    );

    await draftsChip.toggle();

    expect(fixture.componentInstance.draftsToggleCount).toBe(1);
  });

  it('should_emit_mine_toggle_when_the_mine_chip_is_clicked', async () => {
    const { fixture, loader } = await setup();
    const mineChip = await loader.getHarness(
      MatChipOptionHarness.with({ text: t('board.filters.mine') }),
    );

    await mineChip.toggle();

    expect(fixture.componentInstance.mineToggleCount).toBe(1);
  });

  it('should_disable_the_mine_chip_and_show_a_tooltip_when_identity_is_not_configured', async () => {
    const { fixture, el, loader } = await setup();
    fixture.componentInstance.identityConfigured.set(false);
    await fixture.whenStable();

    const mineChip = await loader.getHarness(
      MatChipOptionHarness.with({ text: t('board.filters.mine') }),
    );
    expect(await mineChip.isDisabled()).toBe(true);

    const tooltip = fixture.debugElement.query(By.directive(MatTooltip)).injector.get(MatTooltip);
    expect(tooltip.message).toBe(t('board.filters.mineDisabledTooltip'));
    expect(el.querySelector('.count')).not.toBeNull();
  });

  it('should_show_the_count_label_with_pluralised_mrs_and_projects', async () => {
    const { el } = await setup();

    expect(el.querySelector('.count')?.textContent?.trim()).toBe(
      t('board.filters.count', { count: 2, countSuffix: 's', projects: 2, projectsSuffix: 's' }),
    );
  });

  it('should_hide_the_clear_button_when_mine_is_inactive', async () => {
    const { el } = await setup();

    expect(el.querySelector('.summary button')).toBeNull();
  });

  it('should_show_the_clear_button_and_emit_clear_filters_when_mine_is_active', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.mine.set(true);
    await fixture.whenStable();

    const button = el.querySelector<HTMLButtonElement>('.summary button');
    expect(button?.textContent?.trim()).toBe(t('board.filters.clear'));

    button?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.clearCount).toBe(1);
  });
});
