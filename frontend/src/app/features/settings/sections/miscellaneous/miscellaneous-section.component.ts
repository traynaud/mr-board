import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { TranslateService, TranslationParams } from '../../../../core/i18n/translate.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../../shared/confirm-dialog/confirm-dialog.component';
import { ProjectsStore } from '../../../../stores/projects.store';
import { SettingsStore } from '../../../../stores/settings.store';
import { ImportSummary, parseImportFile, summarizeImport } from '../../config-transfer';
import { SettingsForm, resetSettingsForm } from '../../settings-form';

/** Durée d'affichage des toasts (ms), identique au reste de l'écran Paramètres. */
const TOAST_DURATION_MS = 3500;

/**
 * Section « 06 · Divers » : options de confort (RG-015-01/02) et
 * export/import/reset de la configuration (RG-015-03/04/05). Composant
 * hybride comme `RepositoriesSectionComponent` : les 2 cases actives font
 * partie du formulaire partagé de la page ; export/import sont des actions
 * immédiates gérées ici directement via les stores.
 */
@Component({
  selector: 'app-miscellaneous-section',
  imports: [
    ReactiveFormsModule,
    MatCheckboxModule,
    MatButtonModule,
    MatTooltipModule,
    TranslatePipe,
  ],
  templateUrl: './miscellaneous-section.component.html',
  styleUrl: './miscellaneous-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MiscellaneousSectionComponent {
  private readonly settingsStore = inject(SettingsStore);
  private readonly projectsStore = inject(ProjectsStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly i18n = inject(TranslateService);

  readonly form = input.required<SettingsForm>();

  protected readonly importing = signal(false);

  /** Télécharge la config courante en JSON, hors jeton (RG-015-03). */
  protected async exportConfig(): Promise<void> {
    const { data, errorKey } = await this.settingsStore.exportConfig();
    if (errorKey || !data) {
      this.toast(errorKey ?? 'errors.unexpected');
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mrboard-config.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Lit le fichier sélectionné, le valide, confirme puis importe (RG-015-04).
   * Un fichier invalide affiche un toast et n'ouvre jamais le dialog.
   */
  protected async onFileSelected(files: FileList | null): Promise<void> {
    const file = files?.item(0);
    if (!file) {
      return;
    }
    const config = parseImportFile(await file.text());
    if (!config) {
      this.toast('settings.misc.importInvalid');
      return;
    }
    const currentPaths = this.projectsStore.projects().map((project) => project.pathWithNamespace);
    const summary = summarizeImport(config, currentPaths);
    if (!(await this.confirmImport(summary))) {
      return;
    }
    this.importing.set(true);
    const { result, errorKey } = await this.settingsStore.importConfig(config);
    this.importing.set(false);
    if (errorKey || !result) {
      this.toast(errorKey ?? 'errors.unexpected');
      return;
    }
    resetSettingsForm(this.form(), result.settings);
    void this.projectsStore.load();
    this.toast('settings.misc.importSuccess');
    if (result.projectsSkipped.length > 0) {
      this.toast('settings.misc.importSkipped', {
        paths: result.projectsSkipped.map((skipped) => skipped.pathWithNamespace).join(', '),
      });
    }
  }

  private async confirmImport(summary: ImportSummary): Promise<boolean> {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      {
        data: {
          titleKey: 'settings.misc.importConfirm.title',
          messageKey: 'settings.misc.importConfirm.message',
          confirmKey: 'settings.misc.importConfirm.confirm',
          cancelKey: 'settings.misc.importConfirm.cancel',
          messageParams: { ...summary },
        },
        autoFocus: 'first-tabbable',
      },
    );
    return new Promise<boolean>((resolve) => {
      ref.afterClosed().subscribe((value) => resolve(value === true));
    });
  }

  private toast(key: string, params?: TranslationParams): void {
    this.snackBar.open(this.i18n.translate(key, params), this.i18n.translate('common.ok'), {
      duration: TOAST_DURATION_MS,
      horizontalPosition: 'start',
      panelClass: 'mrb-toast',
    });
  }
}
