import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { startWith } from 'rxjs';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ConnectionsStore } from '../../../../stores/connections.store';
import { SettingsForm } from '../../settings-form';

/**
 * Section « Périmètre » de l'onglet Notifications : « Seulement mes MRs » et
 * « Exclure mes propres actions » (RG-041-06). Avertit quand le premier est
 * coché sans identité résolue, car rien ne serait alors retenu.
 */
@Component({
  selector: 'app-notification-scope-section',
  imports: [ReactiveFormsModule, MatIconModule, MatSlideToggleModule, TranslatePipe],
  templateUrl: './notification-scope-section.component.html',
  styleUrl: './notification-scope-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationScopeSectionComponent {
  private readonly connections = inject(ConnectionsStore);

  readonly form = input.required<SettingsForm>();

  private readonly onlyMine = signal(false);

  constructor() {
    // Suit le contrôle, y compris ses changements programmatiques (Annuler, Réinitialiser, import).
    effect((onCleanup) => {
      const control = this.form().controls.notifOnlyMine;
      const subscription = control.valueChanges
        .pipe(startWith(control.value))
        .subscribe((value) => this.onlyMine.set(value));
      onCleanup(() => subscription.unsubscribe());
    });
  }

  /** Vrai si au moins une connexion a une identité résolue (RG-031-02). */
  protected readonly identityResolved = computed(() =>
    this.connections.connections().some((connection) => connection.identity !== null),
  );

  protected readonly showIdentityWarning = computed(
    () => this.onlyMine() && !this.identityResolved() && !this.connections.loading(),
  );
}
