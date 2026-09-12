import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { DEFAULT_THRESHOLDS, SettingsForm } from '../../settings-form';

/**
 * Section « 05 · Seuils » : seuils de difficulté (RG-G03) et de délai Ready
 * (RG-G04), configurables par l'utilisateur (RG-014-01). Composant
 * présentationnel : le formulaire vient de la page.
 */
@Component({
  selector: 'app-thresholds-section',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    TranslatePipe,
  ],
  templateUrl: './thresholds-section.component.html',
  styleUrl: './thresholds-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThresholdsSectionComponent {
  readonly form = input.required<SettingsForm>();

  /** Rétablit les 7 seuils par défaut, sans les enregistrer (RG-014-05). */
  protected resetDefaults(): void {
    this.form().patchValue(DEFAULT_THRESHOLDS);
    for (const name of Object.keys(DEFAULT_THRESHOLDS) as (keyof typeof DEFAULT_THRESHOLDS)[]) {
      this.form().controls[name].markAsDirty();
    }
  }
}
