import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TranslateService } from '../../../core/i18n/translate.service';
import { ProjectColorSwatch } from '../../../shared/project-color/project-color-palette';

/** Option d'un filtre multi-sélection de la timeline. */
export interface HistoryFilterOption {
  value: string;
  label: string;
  /** Texte secondaire en gris (ex. `@username`). */
  sublabel?: string;
  /** Pastille de couleur du repo (RG-025). */
  swatch?: ProjectColorSwatch | null;
}

/** Nombre de valeurs listées dans la pastille avant « +N ». */
const SHOWN_VALUES = 2;

/**
 * Pastille + menu à cases à cocher d'un filtre multi-sélection de la timeline (RG-038-01/02) :
 * Type, Acteur ou Projet. Présentationnel : reçoit la sélection, émet les intentions.
 */
@Component({
  selector: 'app-history-filter-pill',
  imports: [
    FormsModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    TranslatePipe,
  ],
  templateUrl: './history-filter-pill.component.html',
  styleUrl: './history-filter-pill.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryFilterPillComponent {
  private readonly i18n = inject(TranslateService);

  /** Nom traduit du filtre (« Type », « Acteur », « Projet »). */
  readonly name = input.required<string>();
  readonly options = input.required<HistoryFilterOption[]>();
  readonly selected = input.required<string[]>();
  /** Affiche un champ de recherche dans le menu (longues listes). */
  readonly searchable = input(false);

  readonly toggleValue = output<string>();
  readonly remove = output<void>();

  protected readonly menuOpen = signal(false);
  protected readonly query = signal('');

  protected readonly filteredOptions = computed(() => {
    const query = this.query().trim().toLowerCase();
    if (query === '') {
      return this.options();
    }
    return this.options().filter((option) =>
      `${option.label} ${option.sublabel ?? ''}`.toLowerCase().includes(query),
    );
  });

  /** « Type : Approuvée, Fusionnée +1 » ou « Type : tous ». */
  protected readonly pillLabel = computed(() => {
    const labels = this.selected().map(
      (value) => this.options().find((option) => option.value === value)?.label ?? value,
    );
    if (labels.length === 0) {
      return `${this.name()} : ${this.i18n.translate('history.filters.all')}`;
    }
    const shown = labels.slice(0, SHOWN_VALUES).join(', ');
    const rest = labels.length - SHOWN_VALUES;
    return `${this.name()} : ${shown}${rest > 0 ? ` +${rest}` : ''}`;
  });

  protected readonly removeAriaLabel = computed(() =>
    this.i18n.translate('history.filters.remove', { name: this.name() }),
  );

  protected isSelected(value: string): boolean {
    return this.selected().includes(value);
  }
}
