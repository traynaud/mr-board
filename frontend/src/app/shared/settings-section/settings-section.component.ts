import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

/**
 * Ligne de la grille de l'écran Paramètres : titre numéroté et description à
 * gauche, contenu projeté à droite, règle 2 px en bas (wireframe 1c).
 * L'hôte est en `display: contents` pour s'insérer dans la grille parente.
 */
@Component({
  selector: 'app-settings-section',
  imports: [TranslatePipe],
  template: `
    <div class="heading" [class.last]="last()">
      <h6>{{ number() }} · {{ titleKey() | translate }}</h6>
      @if (descriptionKey(); as key) {
        <p>{{ key | translate }}</p>
      }
    </div>
    <div class="content" [class.last]="last()">
      <ng-content />
    </div>
  `,
  styleUrl: './settings-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsSectionComponent {
  /** Numéro affiché (« 01 », « 02 »…). */
  readonly number = input.required<string>();
  readonly titleKey = input.required<string>();
  readonly descriptionKey = input<string | null>(null);
  /** Dernière section : pas de règle en bas. */
  readonly last = input(false);
}
