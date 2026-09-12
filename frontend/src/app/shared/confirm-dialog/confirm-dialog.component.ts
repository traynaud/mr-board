import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationParams } from '../../core/i18n/translate.service';

/** Clés i18n d'un dialog de confirmation. */
export interface ConfirmDialogData {
  titleKey: string;
  messageKey: string;
  confirmKey: string;
  cancelKey: string;
  /** Valeurs interpolées dans `messageKey` (ex. un résumé d'import US-015). */
  messageParams?: TranslationParams;
}

/**
 * Dialog de confirmation générique. Se ferme avec `true` (confirmer) ou `false`.
 * Ouvrir via `MatDialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(…)`.
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule, TranslatePipe],
  template: `
    <h2 mat-dialog-title>{{ data.titleKey | translate }}</h2>
    <mat-dialog-content>{{ data.messageKey | translate: data.messageParams }}</mat-dialog-content>
    <mat-dialog-actions class="actions">
      <button mat-button type="button" [mat-dialog-close]="false" cdkFocusInitial>
        {{ data.cancelKey | translate }}
      </button>
      <button mat-flat-button type="button" [mat-dialog-close]="true">
        {{ data.confirmKey | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .actions {
      justify-content: flex-start;
      gap: var(--space-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  protected readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}
