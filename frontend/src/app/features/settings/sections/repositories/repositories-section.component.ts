import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
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
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { TranslateService } from '../../../../core/i18n/translate.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../../shared/confirm-dialog/confirm-dialog.component';
import { Project } from '../../../../models/project.model';
import { ConnectionsStore } from '../../../../stores/connections.store';
import { ProjectsStore } from '../../../../stores/projects.store';
import { SyncStore } from '../../../../stores/sync.store';
import { RepoAliasForm, optionalAliasFormatValidator } from '../../repos-form';

/** Durée d'affichage des toasts (ms), identique au reste de l'écran Paramètres. */
const TOAST_DURATION_MS = 3500;

/** Un repo existant apparié à son groupe de formulaire (renommage), par index (RG-003-07). */
export interface RepoRow {
  project: Project;
  group: RepoAliasForm;
  /** Nom de la connexion du repo, affiché en colonne quand ≥ 2 connexions existent (RG-019-15). */
  connectionName: string;
}

/**
 * Champ de `addForm` visé par un code d'erreur d'ajout, `undefined` si
 * l'erreur est globale (toast plutôt qu'erreur inline sur un champ).
 */
const ADD_ERROR_FIELD: Record<string, 'path' | 'alias'> = {
  'errors.projects.notFound': 'path',
  'errors.projects.alreadyConfigured': 'path',
  'errors.projects.aliasDuplicate': 'alias',
};

/**
 * Section « 03 · Repos à scanner ». Composant hybride (voir archi US-003) :
 * la liste des repos existants (renommage d'alias) est reçue en `input()` et
 * fait partie du formulaire partagé de la page (différé, RG-003-07) ; l'ajout
 * et la suppression sont immédiats (RG-003-10) et gérés ici directement via
 * `ProjectsStore`, indépendamment du bouton « Enregistrer » global. Le
 * sélecteur de connexion et la colonne « Connexion » n'apparaissent qu'à
 * partir de 2 connexions configurées (RG-019-15).
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
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    TranslatePipe,
  ],
  templateUrl: './repositories-section.component.html',
  styleUrl: './repositories-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RepositoriesSectionComponent implements OnInit {
  protected readonly store = inject(ProjectsStore);
  protected readonly connectionsStore = inject(ConnectionsStore);
  private readonly syncStore = inject(SyncStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly i18n = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  /** Lignes existantes (renommage), fournies par la page — zip par index avec `projects()`. */
  readonly rows = input.required<RepoRow[]>();

  /** RG-019-15 : le sélecteur et la colonne ne sont affichés qu'à partir de 2 connexions. */
  protected readonly showConnectionSelector = computed(
    () => this.connectionsStore.connections().length > 1,
  );

  protected readonly addForm = new FormGroup({
    connectionId: new FormControl<number | null>(null),
    path: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    alias: new FormControl('', { nonNullable: true, validators: [optionalAliasFormatValidator] }),
  });

  constructor() {
    this.addForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.clearServerErrors());
    // RG-019-15 : la première connexion est présélectionnée dès qu'un
    // sélecteur devient nécessaire (ajout d'une deuxième connexion).
    effect(() => {
      const connections = this.connectionsStore.connections();
      if (connections.length > 0 && this.addForm.controls.connectionId.value === null) {
        this.addForm.controls.connectionId.setValue(connections[0].id);
      }
    });
  }

  ngOnInit(): void {
    void this.store.load();
    // `ConnectionsStore` est chargé par `ConnectionsSectionComponent`, qui
    // apparaît avant cette section dans la page — jamais rechargé ici.
  }

  protected retry(): void {
    void this.store.load();
  }

  protected async addRepo(): Promise<void> {
    if (this.addForm.invalid || this.store.adding()) {
      return;
    }
    this.clearServerErrors();
    const { connectionId, path, alias } = this.addForm.getRawValue();
    const errorKey = await this.store.add({
      path: path.trim(),
      ...(alias ? { alias } : {}),
      ...(this.showConnectionSelector() && connectionId !== null ? { connectionId } : {}),
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
    const keptConnectionId = this.addForm.controls.connectionId.value;
    this.addForm.reset({ connectionId: keptConnectionId, path: '', alias: '' });
    this.toast('settings.projects.added');
  }

  protected async removeRepo(project: Project): Promise<void> {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      {
        data: {
          titleKey: 'settings.projects.deleteConfirm.title',
          messageKey: 'settings.projects.deleteConfirm.message',
          confirmKey: 'settings.projects.deleteConfirm.confirm',
          cancelKey: 'settings.projects.deleteConfirm.cancel',
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
    this.toast(errorKey ?? 'settings.projects.removed');
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
