import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateService } from '../../core/i18n/translate.service';
import { Difficulty } from '../../models/merge-request.model';
import { formatThousands } from '../format/format-number';

/**
 * Jeton de difficulté de relecture (RG-006-03, RG-006-04) : carré coloré +
 * libellé + méta (« N f · M l »), ou « ? » avec tooltip si les statistiques
 * de diff sont indisponibles (RG-006-05, `changedFiles === null`).
 */
@Component({
  selector: 'app-difficulty-badge',
  imports: [MatTooltipModule],
  templateUrl: './difficulty-badge.component.html',
  styleUrl: './difficulty-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DifficultyBadgeComponent {
  private readonly i18n = inject(TranslateService);

  readonly difficulty = input.required<Difficulty>();
  readonly changedFiles = input.required<number | null>();
  readonly additions = input.required<number | null>();
  readonly deletions = input.required<number | null>();
  readonly changedLines = input.required<number | null>();

  protected readonly unavailable = computed(() => this.changedFiles() === null);

  protected readonly label = computed(() =>
    this.unavailable()
      ? this.i18n.translate('board.mergeRequests.difficulty.unavailable')
      : this.i18n.translate(`board.mergeRequests.difficulty.${this.difficulty()}`),
  );

  protected readonly meta = computed(() =>
    this.i18n.translate('board.mergeRequests.difficulty.meta', {
      files: this.changedFiles() ?? 0,
      lines: this.changedLines() ?? 0,
    }),
  );

  protected readonly tooltip = computed(() => {
    if (this.unavailable()) {
      return this.i18n.translate('board.mergeRequests.difficulty.unavailableTooltip');
    }
    const language = this.i18n.language();
    return this.i18n.translate('board.mergeRequests.difficulty.tooltip', {
      files: this.changedFiles() ?? 0,
      lines: formatThousands(this.changedLines() ?? 0, language),
      additions: formatThousands(this.additions() ?? 0, language),
      deletions: formatThousands(this.deletions() ?? 0, language),
    });
  });
}
