import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { MergeRequestSort, MergeRequestView, SortKey } from '../../../models/merge-request.model';
import { AvatarComponent } from '../../../shared/avatar/avatar.component';
import { DifficultyBadgeComponent } from '../../../shared/difficulty-badge/difficulty-badge.component';
import { formatShortDate } from '../../../shared/format/format-date';
import { ReadyDelayComponent } from '../../../shared/ready-delay/ready-delay.component';
import { summarizeUsers } from './summarize-users';

/** Colonnes toujours affichées, dans l'ordre (RG-005-02, RG-007-*). */
const BASE_COLUMNS = [
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
    MatCheckboxModule,
    MatIconModule,
    MatMenuModule,
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
  /** RG-011-09 : visibilité de la colonne optionnelle « Date d'ouverture ». */
  readonly showOpened = input.required<boolean>();

  readonly sortChange = output<SortKey>();
  /** RG-011-09 : bascule la visibilité de la colonne « Date d'ouverture ». */
  readonly toggleOpenedColumn = output<void>();

  protected readonly displayedColumns = computed(() => [
    ...BASE_COLUMNS,
    ...(this.showOpened() ? ['opened'] : []),
    'columnsMenu',
  ]);

  protected readonly summarizeUsers = summarizeUsers;
  protected readonly formatShortDate = formatShortDate;

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
