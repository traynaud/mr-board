import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { TranslateService } from '../../../../core/i18n/translate.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../../shared/confirm-dialog/confirm-dialog.component';
import { formatShortDate } from '../../../../shared/format/format-date';
import { Connection, ConnectionType, TestConnectionResult } from '../../../../models/connection.model';
import { ConnectionsStore } from '../../../../stores/connections.store';
import { ProjectsStore } from '../../../../stores/projects.store';
import {
  ConnectionForm,
  TOKEN_MIN_LENGTH,
  applyConnectionTypeDefaults,
  buildConnectionForm,
  resetConnectionFormForAdd,
  resetConnectionFormForEdit,
} from '../../connections-form';
import { RepoRow, RepositoriesSectionComponent } from '../repositories/repositories-section.component';

/** Durée d'affichage des toasts (ms), identique au reste de l'écran Paramètres. */
const TOAST_DURATION_MS = 3500;

/** Formulaire ouvert : aucun, ajout, ou modification (= dépliée, US-021 §0) d'une connexion existante. */
type OpenForm = { mode: 'add' } | { mode: 'edit'; connectionId: number } | null;

/**
 * Section « 02 · Connexions » (RG-019-10 à RG-019-14, restructurée par
 * US-021 §0/RG-021-00a/b) : liste de connexions dont chaque ligne se déplie
 * pour montrer son formulaire (RG-019-11, inchangé) **suivi** de ses propres
 * repos (`RepositoriesSectionComponent`, scopée à la connexion) — il n'existe
 * plus de section « Repos à scanner » séparée. Persiste immédiatement,
 * indépendamment du bouton « Enregistrer » global (RG-019-12).
 */
@Component({
  selector: 'app-connections-section',
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatRadioModule,
    MatTooltipModule,
    TranslatePipe,
    RepositoriesSectionComponent,
  ],
  templateUrl: './connections-section.component.html',
  styleUrl: './connections-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectionsSectionComponent implements OnInit {
  protected readonly store = inject(ConnectionsStore);
  /** RG-021-00b : les repos vivant désormais ici, une erreur de chargement des projets s'affiche à ce niveau. */
  protected readonly projectsStore = inject(ProjectsStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly i18n = inject(TranslateService);

  /** Repos de toutes les connexions, fournis par la page — filtrés par connexion pour `RepositoriesSectionComponent`. */
  readonly rows = input.required<RepoRow[]>();

  protected readonly tokenMinLength = TOKEN_MIN_LENGTH;
  protected readonly showToken = signal(false);
  protected readonly openForm = signal<OpenForm>(null);
  protected readonly form = signal<ConnectionForm>(buildConnectionForm(true));

  /** Résultat du test à afficher sous le formulaire ouvert (RG-019-11), le cas échéant. */
  protected readonly formTest = computed(() => {
    const open = this.openForm();
    if (!open) {
      return null;
    }
    const targetId = open.mode === 'edit' ? open.connectionId : null;
    return this.store.testedConnectionId() === targetId ? this.store.test() : null;
  });

  /**
   * Non-signal (méthode simple, pas `computed`) car elle lit l'état interne
   * du `FormGroup` (`.value`/`.valid`), qui n'est pas un signal : un
   * `computed` ne se réévalue que lorsqu'un signal dont il dépend change, pas
   * lorsque l'utilisateur tape dans un champ. Réévaluée à chaque cycle de
   * détection de changements, comme `form().invalid` plus bas dans ce
   * template.
   */
  protected canTestForm(): boolean {
    const form = this.form();
    const hasToken = form.controls.token.value.length > 0 || this.isEditingWithToken();
    return form.controls.url.valid && form.controls.token.valid && hasToken;
  }

  /**
   * Méthode simple (pas `computed`), même raison que `canTestForm` : lit
   * `form().controls.type.value`, qui change en direct au clic sur le
   * `mat-radio-group` en mode ajout.
   */
  protected isGithubType(): boolean {
    return this.form().controls.type.value === 'github';
  }

  /** RG-020-01 : re-propose l'URL/le nom par défaut du type nouvellement choisi (ajout seulement). */
  protected onTypeChange(type: ConnectionType): void {
    applyConnectionTypeDefaults(this.form(), type);
  }

  /** RG-021-00a : une seule connexion dépliée à la fois. */
  protected isEditing(connection: Connection): boolean {
    const open = this.openForm();
    return open?.mode === 'edit' && open.connectionId === connection.id;
  }

  /** Repos de `connection`, pour `RepositoriesSectionComponent` (RG-021-00a). */
  protected rowsFor(connectionId: number): RepoRow[] {
    return this.rows().filter((row) => row.project.connectionId === connectionId);
  }

  /** Non-signal, même raison que `canTestForm` : lit `openForm()` en combinaison avec la liste de connexions. */
  protected isEditingWithToken(): boolean {
    const open = this.openForm();
    if (open?.mode !== 'edit') {
      return false;
    }
    return this.store.connections().find((c) => c.id === open.connectionId)?.tokenConfigured ?? false;
  }

  ngOnInit(): void {
    void this.store.load();
    // RG-021-00a : cette section porte désormais aussi les repos (nichés par
    // connexion) — leur chargement lui revient, `RepositoriesSectionComponent`
    // n'étant monté qu'une fois une connexion dépliée.
    void this.projectsStore.load();
  }

  protected async retry(): Promise<void> {
    await this.store.load();
  }

  protected async retryProjects(): Promise<void> {
    await this.projectsStore.load();
  }

  protected async openAdd(): Promise<void> {
    if (!(await this.confirmDiscardIfDirty())) {
      return;
    }
    const form = buildConnectionForm(true);
    resetConnectionFormForAdd(form);
    this.form.set(form);
    this.showToken.set(false);
    this.store.resetTest();
    this.openForm.set({ mode: 'add' });
  }

  /** RG-021-00a : déplie la ligne (comme l'ancien « Modifier ») ou la replie si déjà ouverte. */
  protected async toggleRow(connection: Connection): Promise<void> {
    if (this.isEditing(connection)) {
      await this.cancel();
      return;
    }
    if (!(await this.confirmDiscardIfDirty())) {
      return;
    }
    const form = buildConnectionForm(false);
    resetConnectionFormForEdit(form, connection);
    this.form.set(form);
    this.showToken.set(false);
    this.store.resetTest();
    this.openForm.set({ mode: 'edit', connectionId: connection.id });
  }

  protected async cancel(): Promise<void> {
    if (!(await this.confirmDiscardIfDirty())) {
      return;
    }
    this.openForm.set(null);
  }

  protected toggleToken(): void {
    this.showToken.update((value) => !value);
  }

  protected testFromForm(): void {
    const open = this.openForm();
    if (!open) {
      return;
    }
    const { type, url, token } = this.form().getRawValue();
    void this.store.testConnection({
      type,
      url: url.trim(),
      ...(token ? { token } : {}),
      ...(open.mode === 'edit' ? { connectionId: open.connectionId } : {}),
    });
  }

  protected async testFromList(connection: Connection): Promise<void> {
    await this.store.testConnection({ connectionId: connection.id });
    const test = this.store.test();
    if (test.status === 'success' && test.result) {
      this.toast(
        `${connection.name} : ${this.i18n.translate('settings.connections.result.connected', {
          name: test.result.name,
          username: test.result.username,
        })} · ${this.testResultSummary(test.result)}`,
      );
    } else if (test.status === 'error') {
      this.toast(`${connection.name} : ${this.i18n.translate(test.errorKey ?? 'errors.unexpected')}`);
    }
  }

  /**
   * Résume l'expiration et, le cas échéant, l'absence de vérification de
   * scope (RG-020-03, jeton GitHub fine-grained) d'un test réussi — partagé
   * entre le toast de `testFromList` et l'affichage inline du formulaire.
   */
  protected testResultSummary(result: TestConnectionResult): string {
    const expiry = !result.expirationKnown
      ? this.i18n.translate('settings.connections.result.unknownExpiry')
      : result.expiresAt
        ? this.i18n.translate('settings.connections.result.expires', {
            date: formatShortDate(result.expiresAt, this.i18n.language()),
          })
        : this.i18n.translate('settings.connections.result.noExpiry');
    const scopeSuffix = result.scopeKnown
      ? ''
      : ` · ${this.i18n.translate('settings.connections.result.scopeUnknown')}`;
    return `${expiry}${scopeSuffix}`;
  }

  protected async submit(): Promise<void> {
    const open = this.openForm();
    const form = this.form();
    if (!open || form.invalid || this.store.saving()) {
      return;
    }
    const { type, name, url, token } = form.getRawValue();
    const errorKey =
      open.mode === 'add'
        ? await this.store.add({ type, name: name.trim(), url: url.trim(), token })
        : await this.store.update(open.connectionId, {
            name: name.trim(),
            url: url.trim(),
            ...(token ? { token } : {}),
          });
    if (errorKey) {
      const field = errorKey === 'errors.connections.nameDuplicate' ? 'name' : null;
      if (field) {
        form.controls.name.setErrors({ server: errorKey });
        form.controls.name.markAsTouched();
      } else {
        this.toast(errorKey);
      }
      return;
    }
    if (open.mode === 'add') {
      // RG-021-00a : la carte reste dépliée après création pour enchaîner sur
      // l'ajout des repos — `ConnectionsStore.add` ajoute la nouvelle
      // connexion en fin de tableau, comme `ProjectsStore.add` (voir
      // `RepositoriesSectionComponent.addRepo`).
      const created = this.store.connections().at(-1);
      this.openForm.set(created ? { mode: 'edit', connectionId: created.id } : null);
      this.toast('settings.connections.added');
    } else {
      this.toast('settings.connections.updated');
    }
  }

  protected async remove(connection: Connection): Promise<void> {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      {
        data: {
          titleKey: 'settings.connections.deleteConfirm.title',
          titleParams: { name: connection.name },
          messageKey: 'settings.connections.deleteConfirm.message',
          messageParams: { name: connection.name, count: connection.projectsCount },
          confirmKey: 'settings.connections.deleteConfirm.confirm',
          cancelKey: 'settings.connections.deleteConfirm.cancel',
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
    const open = this.openForm();
    if (open?.mode === 'edit' && open.connectionId === connection.id) {
      this.openForm.set(null);
    }
    const errorKey = await this.store.remove(connection.id);
    this.toast(errorKey ?? 'settings.connections.removed');
  }

  /** RG-019-11 : confirme l'abandon des modifications avant de fermer/changer de formulaire. */
  private async confirmDiscardIfDirty(): Promise<boolean> {
    if (!this.openForm() || this.form().pristine) {
      return true;
    }
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
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
    return new Promise((resolve) => {
      ref.afterClosed().subscribe((value) => resolve(value === true));
    });
  }

  private toast(key: string): void {
    this.snackBar.open(this.i18n.translate(key), this.i18n.translate('common.ok'), {
      duration: TOAST_DURATION_MS,
      horizontalPosition: 'start',
      panelClass: 'mrb-toast',
    });
  }
}
