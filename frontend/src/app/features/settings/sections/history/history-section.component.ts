import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { HISTORY_RETENTION_BOUNDS, SettingsForm } from '../../settings-form';

/**
 * Section « 05 · Historique » : rétention du journal des modifications —
 * âge maximal en jours et nombre maximal d'événements, appliqués
 * cumulativement (RG-036-01/02/03). Composant présentationnel : le formulaire
 * vient de la page.
 */
@Component({
  selector: 'app-history-section',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, TranslatePipe],
  templateUrl: './history-section.component.html',
  styleUrl: './history-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistorySectionComponent {
  readonly form = input.required<SettingsForm>();
  readonly bounds = HISTORY_RETENTION_BOUNDS;
}
