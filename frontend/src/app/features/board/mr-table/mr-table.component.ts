import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { MergeRequestSort, MergeRequestView, SortKey } from '../../../models/merge-request.model';
import { AvatarComponent } from '../../../shared/avatar/avatar.component';
import { DifficultyBadgeComponent } from '../../../shared/difficulty-badge/difficulty-badge.component';
import { ReadyDelayComponent } from '../../../shared/ready-delay/ready-delay.component';
import { summarizeUsers } from './summarize-users';

/**
 * Tableau des MRs ouvertes — 8 colonnes (RG-005-02, RG-007-*). Purement
 * présentationnel : reçoit les lignes déjà triées par le backend
 * (RG-005-01, RG-008-07) et ne recalcule rien (RG-005-11). Les en-têtes
 * « Difficulté » et « Depuis Ready » sont cliquables/activables au clavier
 * et se contentent d'émettre `sortChange` — aucun re-tri local (RG-008-03).
 * Le redimensionnement arrive avec US-012.
 */
@Component({
  selector: 'app-mr-table',
  imports: [
    MatTableModule,
    MatIconModule,
    MatTooltipModule,
    AvatarComponent,
    DifficultyBadgeComponent,
    ReadyDelayComponent,
    TranslatePipe,
  ],
  templateUrl: './mr-table.component.html',
  styleUrl: './mr-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MrTableComponent {
  readonly rows = input.required<MergeRequestView[]>();
  readonly sort = input.required<MergeRequestSort>();
  readonly sortChange = output<SortKey>();

  protected readonly displayedColumns = [
    'project',
    'author',
    'title',
    'difficulty',
    'comments',
    'reviewer',
    'assignee',
    'approved',
    'ready',
  ];

  protected readonly summarizeUsers = summarizeUsers;

  protected readonly trackById = (_index: number, row: MergeRequestView): number => row.id;

  /** `true` si `key` est la colonne actuellement triée (RG-008-06). */
  protected isSortActive(key: SortKey): boolean {
    return this.sort().key === key;
  }

  /** `↑`/`↓` pour la colonne active, `↕` sinon (RG-008-06). */
  protected sortArrow(key: SortKey): '↑' | '↓' | '↕' {
    if (!this.isSortActive(key)) {
      return '↕';
    }
    return this.sort().direction === 'asc' ? '↑' : '↓';
  }

  /** `"ascending"`/`"descending"` pour la colonne active, sinon `null` (pas d'attribut `aria-sort`). */
  protected sortAriaValue(key: SortKey): 'ascending' | 'descending' | null {
    if (!this.isSortActive(key)) {
      return null;
    }
    return this.sort().direction === 'asc' ? 'ascending' : 'descending';
  }
}
