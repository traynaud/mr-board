import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { SettingsForm } from '../../settings-form';

/** Options de cadence proposées (RG-013-01/06), `0` = manuel. */
export const REFRESH_INTERVAL_OPTIONS = [1, 5, 15, 30, 0] as const;

/**
 * Section « 04 · Actualisation » : cadence de synchro planifiée et pause du
 * polling frontend quand l'onglet est masqué (RG-013-01, RG-013-05, RG-013-06).
 * Composant présentationnel : le formulaire vient de la page.
 */
@Component({
  selector: 'app-refresh-section',
  imports: [ReactiveFormsModule, MatRadioModule, MatSlideToggleModule, TranslatePipe],
  templateUrl: './refresh-section.component.html',
  styleUrl: './refresh-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RefreshSectionComponent {
  readonly form = input.required<SettingsForm>();

  protected readonly intervalOptions = REFRESH_INTERVAL_OPTIONS;
}
