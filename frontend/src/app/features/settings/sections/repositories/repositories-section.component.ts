import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { TranslateService } from '../../../../core/i18n/translate.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../../shared/confirm-dialog/confirm-dialog.component';
import { Connection } from '../../../../models/connection.model';
import { Project } from '../../../../models/project.model';
import { ProjectsStore } from '../../../../stores/projects.store';
import { SyncStore } from '../../../../stores/sync.store';
import { RepoAliasForm, optionalAliasFormatValidator } from '../../repos-form';

/** Durée d'affichage des toasts (ms), identique au reste de l'écran Paramètres. */
const TOAST_DURATION_MS = 3500;

/** Un repo existant apparié à son groupe de formulaire (renommage), par index (RG-003-07). */
export interface RepoRow {
  project: Project;
  group: RepoAliasForm;
}

/**
 * Champ de `addForm` visé par un code d'erreur d'ajout, `undefined` si
 * l'erreur est globale (toast plutôt qu'erreur inline sur un champ).
 */
const ADD_ERROR_FIELD: Record<string, 'path' | 'alias'> = {
  'errors.projects.notFound': 'path',
  'errors.projects.alreadyConfigured': 'path',
  'errors.projects.invalidPath': 'path',
  'errors.projects.aliasDuplicate': 'alias',
};

/**
 * Tableau « Dépôts de cette connexion », niché dans la carte dépliée d'une
 * connexion (US-021 §0, RG-021-00a/b — remplace la section globale
 * « 03 · Repos à scanner » de US-019). Scopé à `connection()` : plus de
 * sélecteur ni de colonne « Connexion », `connectionId` est implicite. La
 * liste des repos existants (renommage d'alias) est reçue en `input()` et
 * fait partie du formulaire partagé de la page (différé, RG-003-07) ; l'ajout
 * et la suppression sont immédiats (RG-003-10) et gérés ici directement via
 * `ProjectsStore`, indépendamment du bouton « Enregistrer » global.
 *
 * Les erreurs serveur d'ajout liées à un champ (chemin/alias) sont posées
 * directement sur le `FormControl` concerné via `setErrors({ server: key })`
 * — Angular Material n'affiche `<mat-error>` que lorsque le contrôle associé
 * est lui-même en état d'erreur (`errorState`), pas simplement parce qu'un
 * élément `<mat-error>` est présent dans le template.
 */
@Component({
  selector: 'app-repositories-section',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    TranslatePipe,
  ],
  templateUrl: './repositories-section.component.html',
  styleUrl: './repositories-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RepositoriesSectionComponent {
  protected readonly store = inject(ProjectsStore);
  private readonly syncStore = inject(SyncStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly i18n = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  /** Connexion propriétaire de ces repos (RG-021-00a). */
  readonly connection = input.required<Connection>();
  /** Repos existants de cette connexion (renommage), fournis par la page — zip par index avec `projects()`. */
  readonly rows = input.required<RepoRow[]>();

  protected readonly addForm = new FormGroup({
    path: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    alias: new FormControl('', { nonNullable: true, validators: [optionalAliasFormatValidator] }),
  });

  /** RG-020-05 : dépend du type de la connexion de cette section. */
  protected pathPlaceholderKey(): string {
    return this.connection().type === 'github'
      ? 'settings.connections.repos.pathPlaceholderGithub'
      : 'settings.connections.repos.pathPlaceholderGitlab';
  }

  constructor() {
    this.addForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.clearServerErrors());
  }

  protected async addRepo(): Promise<void> {
    if (this.addForm.invalid || this.store.adding()) {
      return;
    }
    this.clearServerErrors();
    const { path, alias } = this.addForm.getRawValue();
    const errorKey = await this.store.add({
      path: path.trim(),
      ...(alias ? { alias } : {}),
      connectionId: this.connection().id,
    });
    if (errorKey) {
      const field = ADD_ERROR_FIELD[errorKey];
      if (field) {
        const control = this.addForm.controls[field];
        control.setErrors({ server: errorKey });
        control.markAsTouched();
      } else {
        this.toast(errorKey);
      }
      return;
    }
    // Le repo ajouté est déterministement le dernier de la liste juste après
    // un `add()` réussi (`ProjectsStore.add` l'ajoute en fin de tableau) :
    // évite de faire porter à `add()` un contrat de retour différent des
    // autres méthodes des stores (clé i18n | null) pour ce seul besoin.
    const added = this.store.projects().at(-1);
    if (added) {
      // Fire-and-forget (RG-004-15), voir SyncStore.trigger.
      void this.syncStore.trigger(added.id);
    }
    this.addForm.reset({ path: '', alias: '' });
    this.toast('settings.connections.repos.added');
  }

  protected async removeRepo(project: Project): Promise<void> {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      {
        data: {
          titleKey: 'settings.connections.repos.deleteConfirm.title',
          messageKey: 'settings.connections.repos.deleteConfirm.message',
          confirmKey: 'settings.connections.repos.deleteConfirm.confirm',
          cancelKey: 'settings.connections.repos.deleteConfirm.cancel',
        },
        autoFocus: 'first-tabbable',
      },
    );
    const confirmed = await new Promise<boolean>((resolve) => {
      ref.afterClosed().subscribe((value) => resolve(value === true));
    });
    if (!confirmed) {
      return;
    }
    const errorKey = await this.store.remove(project.id);
    this.toast(errorKey ?? 'settings.connections.repos.removed');
  }

  /** Efface une éventuelle erreur serveur posée sur `path`/`alias` (nouvelle saisie). */
  private clearServerErrors(): void {
    for (const control of [this.addForm.controls.path, this.addForm.controls.alias]) {
      if (control.hasError('server')) {
        control.updateValueAndValidity();
      }
    }
  }

  private toast(key: string): void {
    this.snackBar.open(this.i18n.translate(key), this.i18n.translate('common.ok'), {
      duration: TOAST_DURATION_MS,
      horizontalPosition: 'start',
      panelClass: 'mrb-toast',
    });
  }
}
