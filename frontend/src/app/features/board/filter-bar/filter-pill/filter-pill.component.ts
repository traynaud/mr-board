import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { TranslateService } from '../../../../core/i18n/translate.service';
import { FacetOption, FilterKey, isMultiValueFilter } from '../../../../models/merge-request.model';
import { Project } from '../../../../models/project.model';
import { computeInitials } from '../../../../shared/avatar/compute-initials';
import { ProjectColorSwatch, findProjectColor } from '../../../../shared/project-color/project-color-palette';

/** Au-delà de ce nombre d'options, le champ « Rechercher… » apparaît (RG-010-05). */
const SEARCH_THRESHOLD = 6;

/**
 * Pastille d'un filtre composable actif (RG-010-04) : un seul composant
 * pour les 5 filtres, qui bascule son rendu (multi-sélection ou booléen)
 * selon `filterKey`. Purement présentationnel : reçoit les options/valeurs
 * sélectionnées, émet les intentions, ne recharge jamais lui-même.
 */
@Component({
  selector: 'app-filter-pill',
  imports: [
    FormsModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    TranslatePipe,
  ],
  templateUrl: './filter-pill.component.html',
  styleUrl: './filter-pill.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterPillComponent {
  private readonly i18n = inject(TranslateService);

  readonly filterKey = input.required<FilterKey>();
  readonly options = input.required<FacetOption[]>();
  /** Sélection courante pour un filtre multi (`project`/`author`/`assigned`) ; `[]` pour un filtre booléen. */
  readonly multiSelected = input<string[]>([]);
  /** Sélection courante pour un filtre booléen (`approved`/`commented`) ; `null` pour un filtre multi. */
  readonly booleanSelected = input<'yes' | 'no' | null>(null);
  /** RG-025-09 : repos configurés, pour la pastille de couleur des options du filtre Projet. */
  readonly projects = input<Project[]>([]);

  /** RG-010-05 : bascule `value` dans la sélection multi, sans fermer le menu. */
  readonly toggleValue = output<string>();
  /** RG-010-06 : choisit (ou désélectionne si déjà sélectionnée) une valeur booléenne. */
  readonly selectBoolean = output<'yes' | 'no'>();
  /** RG-010-04 : retire la pastille (croix). */
  readonly remove = output<void>();

  protected readonly menuOpen = signal(false);
  protected readonly search = signal('');

  protected readonly isMulti = computed(() => isMultiValueFilter(this.filterKey()));

  /** RG-025-09 : couleur pleine de chaque repo (par alias), pour le filtre Projet uniquement. */
  private readonly colorByAlias = computed(
    () => new Map(this.projects().map((project) => [project.alias, project.color])),
  );

  /** `null` si `filterKey` n'est pas `'project'` ou si le repo n'a pas de couleur (RG-025-01). */
  protected swatchFor(option: FacetOption): ProjectColorSwatch | null {
    if (this.filterKey() !== 'project') {
      return null;
    }
    return findProjectColor(this.colorByAlias().get(option.value));
  }

  protected readonly filterName = computed(() =>
    this.i18n.translate(`board.filters.pills.names.${this.filterKey()}`),
  );

  protected readonly menuTitle = computed(() =>
    this.filterKey() === 'assigned'
      ? this.i18n.translate('board.filters.pills.titles.assigned')
      : this.filterName(),
  );

  protected readonly showSearch = computed(
    () => this.isMulti() && this.options().length > SEARCH_THRESHOLD,
  );

  protected readonly filteredOptions = computed(() => {
    const query = this.search().trim().toLowerCase();
    if (!query) {
      return this.options();
    }
    return this.options().filter((option) => option.label.toLowerCase().includes(query));
  });

  /** RG-010-04 : « <Filtre> : <valeur> », « tous »/« — » si rien n'est sélectionné. */
  protected readonly valueLabel = computed(() => {
    if (!this.isMulti()) {
      const value = this.booleanSelected();
      if (value === null) {
        return this.i18n.translate('board.filters.pills.none');
      }
      return this.options().find((option) => option.value === value)?.label ?? value;
    }
    const selected = this.multiSelected();
    if (selected.length === 0) {
      return this.i18n.translate('board.filters.pills.all');
    }
    if (this.filterKey() === 'project') {
      return selected.join(', ');
    }
    const labelsByValue = new Map(this.options().map((option) => [option.value, option.label]));
    return selected
      .map((value) => {
        const label = labelsByValue.get(value);
        // RG-028-14 : les labels ne sont pas des noms de personnes — pas
        // d'initiales, texte brut (via l'option, pour « Sans label »/RG-028-13).
        if (this.filterKey() === 'label' || value === 'nobody') {
          return label ?? value;
        }
        return label ? computeInitials(label) : value;
      })
      .join(', ');
  });

  protected readonly pillLabel = computed(() => `${this.filterName()} : ${this.valueLabel()}`);

  protected readonly removeAriaLabel = computed(() =>
    this.i18n.translate('board.filters.pills.remove', { name: this.filterName() }),
  );

  protected isSelected(value: string): boolean {
    return this.isMulti() ? this.multiSelected().includes(value) : this.booleanSelected() === value;
  }

  protected onOptionClick(value: string): void {
    if (this.isMulti()) {
      this.toggleValue.emit(value);
    } else {
      this.selectBoolean.emit(value === 'yes' ? 'yes' : 'no');
    }
  }
}
