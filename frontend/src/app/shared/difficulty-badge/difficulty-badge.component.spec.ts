import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatTooltip } from '@angular/material/tooltip';
import { By } from '@angular/platform-browser';
import { provideI18nTesting, t } from '../../core/i18n/testing';
import { Difficulty } from '../../models/merge-request.model';
import { DifficultyBadgeComponent } from './difficulty-badge.component';

@Component({
  imports: [DifficultyBadgeComponent],
  template: `
    <app-difficulty-badge
      [difficulty]="difficulty()"
      [changedFiles]="changedFiles()"
      [additions]="additions()"
      [deletions]="deletions()"
      [changedLines]="changedLines()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly difficulty = signal<Difficulty>('hard');
  readonly changedFiles = signal<number | null>(34);
  readonly additions = signal<number | null>(900);
  readonly deletions = signal<number | null>(340);
  readonly changedLines = signal<number | null>(1240);
}

describe('DifficultyBadgeComponent', () => {
  const setup = async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  };

  it('should_render_a_colored_square_label_and_meta_for_hard', async () => {
    const { el } = await setup();

    expect(el.querySelector('.square')?.classList.contains('hard')).toBe(true);
    expect(el.querySelector('.label')?.textContent?.trim()).toBe(
      t('board.mergeRequests.difficulty.hard'),
    );
    expect(el.querySelector('.meta')?.textContent?.trim()).toBe('34 f · 1240 l');
  });

  it('should_show_a_detailed_tooltip_with_thousands_separator', async () => {
    const { fixture, el } = await setup();

    const tooltip = fixture.debugElement.query(By.directive(MatTooltip)).injector.get(MatTooltip);
    expect(tooltip.message).toBe(
      '34 fichiers modifiés · 1 240 lignes (+900 / −340)',
    );
    expect(el.querySelector('.badge.unavailable')).toBeNull();
  });

  it.each<[Difficulty, string]>([
    ['easy', 'easy'],
    ['medium', 'medium'],
  ])('should_apply_the_%s_color_class', async (difficulty, expectedClass) => {
    const { fixture, el } = await setup();
    fixture.componentInstance.difficulty.set(difficulty);
    await fixture.whenStable();

    expect(el.querySelector('.square')?.classList.contains(expectedClass)).toBe(true);
  });

  it('should_use_a_comma_thousands_separator_in_the_tooltip_when_the_language_is_english', async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideI18nTesting('en')],
    }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();

    const tooltip = fixture.debugElement.query(By.directive(MatTooltip)).injector.get(MatTooltip);
    expect(tooltip.message).toBe('34 files changed · 1,240 lines (+900 / −340)');
  });

  it('should_show_a_question_mark_and_unavailable_tooltip_when_stats_are_null', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.changedFiles.set(null);
    fixture.componentInstance.additions.set(null);
    fixture.componentInstance.deletions.set(null);
    fixture.componentInstance.changedLines.set(null);
    await fixture.whenStable();

    expect(el.querySelector('.badge.unavailable')?.textContent?.trim()).toBe(
      t('board.mergeRequests.difficulty.unavailable'),
    );
    expect(el.querySelector('.square')).toBeNull();
    const tooltip = fixture.debugElement.query(By.directive(MatTooltip)).injector.get(MatTooltip);
    expect(tooltip.message).toBe(t('board.mergeRequests.difficulty.unavailableTooltip'));
  });
});
