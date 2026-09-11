import { inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CanDeactivateFn } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../shared/confirm-dialog/confirm-dialog.component';

/** Contrat des pages protégées par {@link unsavedChangesGuard}. */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/**
 * Demande confirmation avant de quitter une page avec des modifications non
 * enregistrées (RG-001-07). Couvre Annuler, retour et le bouton précédent.
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = async (component) => {
  if (!component.hasUnsavedChanges()) {
    return true;
  }
  const dialog = inject(MatDialog);
  const ref = dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
    ConfirmDialogComponent,
    {
      data: {
        titleKey: 'settings.unsaved.title',
        messageKey: 'settings.unsaved.message',
        confirmKey: 'settings.unsaved.discard',
        cancelKey: 'settings.unsaved.stay',
      },
      autoFocus: 'first-tabbable',
    },
  );
  return (await firstValueFrom(ref.afterClosed())) === true;
};
