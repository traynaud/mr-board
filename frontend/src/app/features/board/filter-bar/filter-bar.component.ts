import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TranslateService } from '../../../core/i18n/translate.service';
import { MergeRequestView } from '../../../models/merge-request.model';
import { countLabelParts } from './count-label';

/**
 * Barre de filtres rapides (RG-009-*) : chips « Drafts » / « Mes MRs »,
 * compteur (RG-G20) et bouton « Effacer » — visible seulement si « Mes
 * MRs » est actif (RG-009-05, seul un vrai filtre, pas une préférence
 * d'affichage). Purement présentationnel : reçoit l'état, émet les
 * intentions de bascule, ne recharge jamais lui-même.
 */
@Component({
  selector: 'app-filter-bar',
  imports: [MatButtonModule, MatChipsModule, MatIconModule, MatTooltipModule, TranslatePipe],
  templateUrl: './filter-bar.component.html',
  styleUrl: './filter-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterBarComponent {
  private readonly i18n = inject(TranslateService);

  readonly drafts = input.required<boolean>();
  readonly mine = input.required<boolean>();
  readonly identityConfigured = input.required<boolean>();
  readonly rows = input.required<MergeRequestView[]>();

  readonly draftsToggle = output<void>();
  readonly mineToggle = output<void>();
  readonly clearFilters = output<void>();

  protected readonly countLabel = computed(() => {
    const parts = countLabelParts(this.rows());
    return this.i18n.translate('board.filters.count', {
      count: parts.count,
      countSuffix: parts.countSuffix,
      projects: parts.projects,
      projectsSuffix: parts.projectsSuffix,
    });
  });
}
