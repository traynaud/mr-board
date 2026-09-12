import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateService } from '../../core/i18n/translate.service';
import { ReadyLevel } from '../../models/merge-request.model';
import { formatDateTime } from '../format/format-date';

/**
 * Cellule « Depuis Ready » : carré coloré + libellé en gras pour une MR
 * Ready (RG-007-02, RG-007-03), ou libellé gris sans pastille pour un draft
 * (RG-007-05, `draft === true`).
 */
@Component({
  selector: 'app-ready-delay',
  imports: [MatTooltipModule],
  templateUrl: './ready-delay.component.html',
  styleUrl: './ready-delay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReadyDelayComponent {
  private readonly i18n = inject(TranslateService);

  readonly draft = input.required<boolean>();
  readonly readyAt = input.required<string | null>();
  readonly readyDays = input.required<number | null>();
  readonly readyLevel = input.required<ReadyLevel | null>();
  readonly openedDays = input.required<number>();

  protected readonly label = computed(() => {
    if (this.draft()) {
      return this.openedDays() === 0
        ? this.i18n.translate('board.mergeRequests.ready.openedToday')
        : this.i18n.translate('board.mergeRequests.ready.openedDays', {
            days: this.openedDays(),
          });
    }
    return this.readyDays() === 0
      ? this.i18n.translate('board.mergeRequests.ready.today')
      : this.i18n.translate('board.mergeRequests.ready.days', {
          days: this.readyDays() ?? 0,
        });
  });

  protected readonly tooltip = computed(() => {
    const readyAt = this.readyAt();
    if (this.draft() || readyAt === null) {
      return '';
    }
    return this.i18n.translate('board.mergeRequests.ready.tooltip', {
      date: formatDateTime(readyAt),
    });
  });
}
