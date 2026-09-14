import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TranslateService } from '../../../core/i18n/translate.service';
import { MergeRequestSort, MergeRequestView, SortKey } from '../../../models/merge-request.model';
import { Project } from '../../../models/project.model';
import { AvatarComponent } from '../../../shared/avatar/avatar.component';
import { DifficultyBadgeComponent } from '../../../shared/difficulty-badge/difficulty-badge.component';
import { formatDateTime, formatShortDate } from '../../../shared/format/format-date';
import { MergeStatusIconComponent } from '../../../shared/merge-status-icon/merge-status-icon.component';
import { ProjectTagStyle, projectTagStyle } from '../../../shared/project-color/project-tag-style';
import { ReadyDelayComponent } from '../../../shared/ready-delay/ready-delay.component';
import { ResizableColumnDirective } from '../../../shared/resizable-column/resizable-column.directive';
import type { ResizableColumnKey } from '../../../stores/column-widths.store';
import { summarizeUsers } from './summarize-users';

/** Colonnes toujours affichées avant la colonne optionnelle « Statut » (RG-005-02). */
const COLUMNS_BEFORE_STATUS = [
  'project',
  'author',
  'title',
  'difficulty',
  'comments',
  'reviewer',
  'assignee',
  'approved',
];

/** Colonnes toujours affichées après la colonne optionnelle « Statut » (RG-017-07). */
const COLUMNS_AFTER_STATUS = ['ready'];

/**
 * Tableau des MRs ouvertes — 8 colonnes (RG-005-02, RG-007-*), largeurs
 * ajustables (RG-012-*). Purement présentationnel : reçoit les lignes déjà
 * triées par le backend (RG-005-01, RG-008-07) et ne recalcule rien
 * (RG-005-11), ne connaît ni `ColumnsStore` ni `ColumnWidthsStore` — tout
 * est reçu en entrée / émis en sortie, câblé par `BoardPageComponent`. Les
 * en-têtes « Difficulté » et « Depuis Ready » sont cliquables/activables au
 * clavier et se contentent d'émettre `sortChange` — aucun re-tri local
 * (RG-008-03).
 */
@Component({
  selector: 'app-mr-table',
  imports: [
    MatTableModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDividerModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    AvatarComponent,
    DifficultyBadgeComponent,
    MergeStatusIconComponent,
    ReadyDelayComponent,
    ResizableColumnDirective,
    TranslatePipe,
  ],
  templateUrl: './mr-table.component.html',
  styleUrl: './mr-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MrTableComponent {
  private readonly i18n = inject(TranslateService);
  /** Langue courante (RG-022-10), exposée pour les appels de formatage du template. */
  protected readonly language = this.i18n.language;

  readonly rows = input.required<MergeRequestView[]>();
  /** Repos configurés, pour résoudre le `pathWithNamespace` de l'infobulle du tag projet (RG-021-02). */
  readonly projects = input<Project[]>([]);
  /** RG-021-01 : icône de forge avant l'alias, seulement si ≥ 2 types de forge sont configurés. */
  readonly showForgeIcon = input(false);
  /** RG-021-02 : l'infobulle nomme la connexion en plus du chemin, seulement à partir de 2 connexions. */
  readonly showConnectionInTooltip = input(false);
  readonly sort = input.required<MergeRequestSort>();
  /** RG-017-09 : visibilité de la colonne optionnelle « Statut ». */
  readonly showStatus = input.required<boolean>();
  /** RG-011-09 : visibilité de la colonne optionnelle « Date d'ouverture ». */
  readonly showOpened = input.required<boolean>();
  /** RG-012-01/02/03 : largeurs effectives (défauts + overrides), déjà résolues par l'appelant. */
  readonly columnWidths = input.required<Record<ResizableColumnKey, number>>();
  /** RG-G11, RG-015-01 : ouvre le titre dans un nouvel onglet plutôt que le même. */
  readonly openInNewTab = input(false);
  /** RG-023-01/06 : surligne mon avatar et le promeut en position affichée. */
  readonly highlightMe = input(true);

  readonly sortChange = output<SortKey>();
  /** RG-017-09 : bascule la visibilité de la colonne « Statut ». */
  readonly toggleStatusColumn = output<void>();
  /** RG-011-09 : bascule la visibilité de la colonne « Date d'ouverture ». */
  readonly toggleOpenedColumn = output<void>();
  /** RG-012-01/07 : nouvelle largeur (glisser ou clavier), déjà bornée. */
  readonly widthChange = output<{ key: ResizableColumnKey; width: number }>();
  /** RG-012-04 : double-clic sur une poignée, une seule colonne. */
  readonly resetColumnWidth = output<ResizableColumnKey>();
  /** RG-012-04/05 : item de menu « Réinitialiser les largeurs », toutes colonnes. */
  readonly resetAllWidths = output<void>();
  /** RG-027-08 : bascule le favori de la ligne cliquée. */
  readonly favoriteToggle = output<MergeRequestView>();

  protected readonly displayedColumns = computed(() => [
    'favorite',
    ...COLUMNS_BEFORE_STATUS,
    ...(this.showStatus() ? ['status'] : []),
    ...COLUMNS_AFTER_STATUS,
    ...(this.showOpened() ? ['opened'] : []),
    'columnsMenu',
  ]);

  /** RG-021-02 : chemin de chaque repo configuré, indexé par alias. */
  private readonly pathByAlias = computed(
    () => new Map(this.projects().map((project) => [project.alias, project.pathWithNamespace])),
  );

  /** RG-025-06 : couleur de chaque repo configuré, indexée par alias. */
  private readonly colorByAlias = computed(
    () => new Map(this.projects().map((project) => [project.alias, project.color])),
  );

  /** RG-021-02 : « <chemin> » avec une seule connexion, « <connexion> · <chemin> » à partir de deux. */
  protected tagTooltip(row: MergeRequestView): string {
    const path = this.pathByAlias().get(row.projectAlias) ?? '';
    return this.showConnectionInTooltip() ? `${row.connection.name} · ${path}` : path;
  }

  /**
   * Style de la case Projet (RG-025-03/04), `null` si le repo n'a pas de
   * couleur — le tag garde alors `tag-neutral` (inchangé, RG-025-01).
   */
  protected tagStyle(row: MergeRequestView): ProjectTagStyle | null {
    return projectTagStyle(this.colorByAlias().get(row.projectAlias), row.draft);
  }

  protected readonly summarizeUsers = summarizeUsers;
  protected readonly formatShortDate = formatShortDate;
  protected readonly formatDateTime = formatDateTime;

  protected readonly trackById = (_index: number, row: MergeRequestView): number => row.id;

  /** RG-012-07 : `aria-label` traduit de la poignée d'une colonne. */
  protected resizeAriaLabel(columnNameKey: string): string {
    return this.i18n.translate('board.columns.resizeAriaLabel', {
      name: this.i18n.translate(columnNameKey),
    });
  }

  /** RG-027-08 : `aria-label` traduit du bouton étoile, différent selon l'état actuel. */
  protected favoriteAriaLabel(row: MergeRequestView): string {
    const key = row.isFavorite
      ? 'board.mergeRequests.favorite.remove'
      : 'board.mergeRequests.favorite.add';
    return this.i18n.translate(key, { title: row.title });
  }

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
