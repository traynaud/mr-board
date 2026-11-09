import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TranslateService } from '../../../core/i18n/translate.service';
import { HistoryEvent } from '../../../models/history.model';
import { AvatarComponent } from '../../../shared/avatar/avatar.component';
import { formatDateTime, formatTime } from '../../../shared/format/format-date';
import { ProjectTagStyle } from '../../../shared/project-color/project-tag-style';
import { describeEvent, toneOf } from '../describe-event';

/**
 * Une ligne de la timeline (RG-037-02) : heure, acteur (avatar ou carré
 * pointillé s'il est inconnu, RG-037-05), pastille de type, phrase, tag projet,
 * lien vers la MR et détail (ancien → nouveau, extrait de commentaire).
 */
@Component({
  selector: 'app-history-event-row',
  imports: [AvatarComponent, MatTooltipModule, TranslatePipe],
  templateUrl: './history-event-row.component.html',
  styleUrl: './history-event-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'listitem' },
})
export class HistoryEventRowComponent {
  private readonly i18n = inject(TranslateService);

  readonly event = input.required<HistoryEvent>();
  /** Style du tag projet (RG-025-03), `null` = neutre. */
  readonly tagStyle = input<ProjectTagStyle | null>(null);

  protected readonly description = computed(() => describeEvent(this.event()));
  protected readonly tone = computed(() => toneOf(this.event().type));
  protected readonly time = computed(() => formatTime(this.event().occurredAt));
  /** Date exacte au survol (RG-037-02). */
  protected readonly exactDate = computed(() =>
    formatDateTime(this.event().occurredAt, this.i18n.language()),
  );
  protected readonly actorName = computed(() => {
    const actor = this.event().actor;
    return actor?.name || actor?.username || null;
  });
}
