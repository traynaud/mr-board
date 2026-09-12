import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { MergeRequestView } from '../../../models/merge-request.model';
import { AvatarComponent } from '../../../shared/avatar/avatar.component';
import { summarizeUsers } from './summarize-users';

/**
 * Tableau des MRs ouvertes — 7 colonnes de base (RG-005-02). Purement
 * présentationnel : reçoit les lignes déjà triées par le backend
 * (RG-005-01) et ne recalcule rien (RG-005-11). Le tri par colonne et le
 * redimensionnement arrivent avec US-008/US-012.
 */
@Component({
  selector: 'app-mr-table',
  imports: [MatTableModule, MatIconModule, MatTooltipModule, AvatarComponent, TranslatePipe],
  templateUrl: './mr-table.component.html',
  styleUrl: './mr-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MrTableComponent {
  readonly rows = input.required<MergeRequestView[]>();

  protected readonly displayedColumns = [
    'project',
    'author',
    'title',
    'comments',
    'reviewer',
    'assignee',
    'approved',
  ];

  protected readonly summarizeUsers = summarizeUsers;

  protected readonly trackById = (_index: number, row: MergeRequestView): number => row.id;
}
