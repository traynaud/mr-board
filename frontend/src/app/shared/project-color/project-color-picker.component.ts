import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateService } from '../../core/i18n/translate.service';
import { PROJECT_COLOR_PALETTE, findProjectColor } from './project-color-palette';

const NONE_LABEL_KEY = 'settings.connections.repos.colors.none';

/**
 * Sélecteur de la couleur d'un repo (RG-025-01, RG-025-02, RG-025-07) :
 * bouton pastille ouvrant un menu listant « Aucune » puis les 10 couleurs de
 * la palette, coche sur l'option sélectionnée (même pattern que
 * `AddFilterMenuComponent`). Purement présentationnel.
 */
@Component({
  selector: 'app-project-color-picker',
  imports: [MatIconModule, MatMenuModule, MatTooltipModule],
  templateUrl: './project-color-picker.component.html',
  styleUrl: './project-color-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectColorPickerComponent {
  private readonly i18n = inject(TranslateService);

  /** Id de couleur courant (`ProjectColorId`), `null` = « Aucune ». */
  readonly value = input<string | null>(null);
  /** Nom du repo, inséré dans l'aria-label du bouton déclencheur (ex : son alias). */
  readonly name = input('');

  readonly valueChange = output<string | null>();

  protected readonly palette = PROJECT_COLOR_PALETTE;

  protected readonly currentSwatch = computed(() => findProjectColor(this.value()));

  protected readonly currentLabel = computed(() =>
    this.i18n.translate(this.currentSwatch()?.labelKey ?? NONE_LABEL_KEY),
  );

  protected readonly triggerAriaLabel = computed(() =>
    this.i18n.translate('settings.connections.repos.colors.pickerLabel', {
      alias: this.name(),
      color: this.currentLabel(),
    }),
  );

  protected labelFor(id: string | null): string {
    return this.i18n.translate(findProjectColor(id)?.labelKey ?? NONE_LABEL_KEY);
  }

  protected isSelected(id: string | null): boolean {
    return (this.value() ?? null) === id;
  }

  protected select(id: string | null): void {
    this.valueChange.emit(id);
  }
}
