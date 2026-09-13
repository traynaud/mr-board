import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
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
import { Connection } from '../../../../models/connection.model';
import { ConnectionsStore } from '../../../../stores/connections.store';
import {
  ConnectionForm,
  TOKEN_MIN_LENGTH,
  buildConnectionForm,
  resetConnectionFormForAdd,
  resetConnectionFormForEdit,
} from '../../connections-form';

/** Durée d'affichage des toasts (ms), identique au reste de l'écran Paramètres. */
const TOAST_DURATION_MS = 3500;

/** Formulaire ouvert : aucun, ajout, ou modification d'une connexion existante. */
type OpenForm = { mode: 'add' } | { mode: 'edit'; connectionId: number } | null;

/**
 * Section « 02 · Connexions » (RG-019-10 à RG-019-14) : liste compacte des
 * connexions configurées + formulaire inline d'ajout/modification. Persiste
 * immédiatement, indépendamment du bouton « Enregistrer » global (même
 * principe que `RepositoriesSectionComponent`, RG-019-12).
 */
@Component({
  selector: 'app-connections-section',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatRadioModule,
    MatTooltipModule,
    TranslatePipe,
  ],
  templateUrl: './connections-section.component.html',
  styleUrl: './connections-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectionsSectionComponent implements OnInit {
  protected readonly store = inject(ConnectionsStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly i18n = inject(TranslateService);

  protected readonly tokenMinLength = TOKEN_MIN_LENGTH;
  protected readonly showToken = signal(false);
  protected readonly openForm = signal<OpenForm>(null);
  protected readonly form = signal<ConnectionForm>(buildConnectionForm(true));

  /** `null` pour le formulaire d'ajout (pas encore de connexion existante). */
  protected readonly editingConnection = computed<Connection | null>(() => {
    const open = this.openForm();
    if (!open || open.mode !== 'edit') {
      return null;
    }
    return this.store.connections().find((c) => c.id === open.connectionId) ?? null;
  });

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
    const hasToken =
      form.controls.token.value.length > 0 ||
      (this.editingConnection()?.tokenConfigured ?? false);
    return form.controls.url.valid && form.controls.token.valid && hasToken;
  }

  ngOnInit(): void {
    void this.store.load();
  }

  protected async retry(): Promise<void> {
    await this.store.load();
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

  protected async openEdit(connection: Connection): Promise<void> {
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
      const expiry = !test.result.expirationKnown
        ? this.i18n.translate('settings.connections.result.unknownExpiry')
        : test.result.expiresAt
          ? this.i18n.translate('settings.connections.result.expires', {
              date: formatShortDate(test.result.expiresAt, this.i18n.language()),
            })
          : this.i18n.translate('settings.connections.result.noExpiry');
      this.toast(
        `${connection.name} : ${this.i18n.translate('settings.connections.result.connected', {
          name: test.result.name,
          username: test.result.username,
        })} · ${expiry}`,
      );
    } else if (test.status === 'error') {
      this.toast(`${connection.name} : ${this.i18n.translate(test.errorKey ?? 'errors.unexpected')}`);
    }
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
    this.openForm.set(null);
    this.toast(open.mode === 'add' ? 'settings.connections.added' : 'settings.connections.updated');
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
