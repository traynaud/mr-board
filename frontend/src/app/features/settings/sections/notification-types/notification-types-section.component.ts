import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { startWith } from 'rxjs';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { HistoryEventType } from '../../../../models/history.model';
import { SettingsForm } from '../../settings-form';

/** Les 18 types d'événements, regroupés par thème pour la lisibilité (RG-041-05). */
export const NOTIFICATION_TYPE_GROUPS: readonly {
  key: 'lifecycle' | 'review' | 'content';
  types: readonly HistoryEventType[];
}[] = [
  {
    key: 'lifecycle',
    types: [
      'created',
      'marked_draft',
      'marked_ready',
      'merged',
      'closed',
      'reopened',
      'deleted',
      'disappeared',
    ],
  },
  {
    key: 'review',
    types: [
      'approved',
      'approval_removed',
      'reviewer_added',
      'reviewer_removed',
      'assignee_added',
      'assignee_removed',
    ],
  },
  { key: 'content', types: ['title_changed', 'commented', 'label_added', 'label_removed'] },
];

/**
 * Section « Types d'événements » de l'onglet Notifications (RG-041-01/03/05) :
 * une case par type, cochée tant que le type n'est pas dans `notifDisabledTypes`,
 * avec « Tout cocher / Tout décocher » par groupe.
 */
@Component({
  selector: 'app-notification-types-section',
  imports: [MatCheckboxModule, TranslatePipe],
  templateUrl: './notification-types-section.component.html',
  styleUrl: './notification-types-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationTypesSectionComponent {
  readonly form = input.required<SettingsForm>();

  protected readonly groups = NOTIFICATION_TYPE_GROUPS;

  private readonly disabledTypes = signal<HistoryEventType[]>([]);

  /** Types actuellement masqués du panneau. */
  protected readonly disabled = computed(() => new Set(this.disabledTypes()));

  constructor() {
    // Suit le contrôle, y compris ses changements programmatiques (Annuler, Réinitialiser, import).
    effect((onCleanup) => {
      const control = this.form().controls.notifDisabledTypes;
      const subscription = control.valueChanges
        .pipe(startWith(control.value))
        .subscribe((value) => this.disabledTypes.set(value));
      onCleanup(() => subscription.unsubscribe());
    });
  }

  /** Coche / décoche un type (RG-041-03). */
  protected toggle(type: HistoryEventType, enabled: boolean): void {
    this.setEnabled([type], enabled);
  }

  /** « Tout cocher » / « Tout décocher » sur un groupe (RG-041-05). */
  protected setGroup(types: readonly HistoryEventType[], enabled: boolean): void {
    this.setEnabled(types, enabled);
  }

  private setEnabled(types: readonly HistoryEventType[], enabled: boolean): void {
    const control = this.form().controls.notifDisabledTypes;
    const next = new Set(control.value);
    for (const type of types) {
      if (enabled) {
        next.delete(type);
      } else {
        next.add(type);
      }
    }
    control.setValue([...next]);
    control.markAsDirty();
  }
}
