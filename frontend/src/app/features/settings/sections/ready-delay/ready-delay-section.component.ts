import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { SettingsForm } from '../../settings-form';

/**
 * Section « 05 · Temps depuis Ready » : seuils de couleur du délai depuis
 * Ready (RG-G04) et option jours ouvrés, configurables par l'utilisateur
 * (RG-014-01, RG-030-01). Composant présentationnel : le formulaire vient
 * de la page.
 */
@Component({
  selector: 'app-ready-delay-section',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    TranslatePipe,
  ],
  templateUrl: './ready-delay-section.component.html',
  styleUrl: './ready-delay-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReadyDelaySectionComponent {
  readonly form = input.required<SettingsForm>();
}
