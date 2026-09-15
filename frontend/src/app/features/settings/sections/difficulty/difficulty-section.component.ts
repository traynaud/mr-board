import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { SettingsForm } from '../../settings-form';

/**
 * Section « 04 · Difficulté » : seuils de difficulté d'une MR (RG-G03),
 * configurables par l'utilisateur (RG-014-01, RG-030-01). Composant
 * présentationnel : le formulaire vient de la page.
 */
@Component({
  selector: 'app-difficulty-section',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, TranslatePipe],
  templateUrl: './difficulty-section.component.html',
  styleUrl: './difficulty-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DifficultySectionComponent {
  readonly form = input.required<SettingsForm>();
}
