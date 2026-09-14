import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TranslateService } from '../../../core/i18n/translate.service';
import {
  ComposableFilters,
  FacetOption,
  FilterKey,
  MergeRequestView,
  MergeRequestsFacets,
  isMultiValueFilter,
} from '../../../models/merge-request.model';
import { Project } from '../../../models/project.model';
import { AddFilterMenuComponent } from './add-filter-menu/add-filter-menu.component';
import { countLabelParts } from './count-label';
import { FilterPillComponent } from './filter-pill/filter-pill.component';

/**
 * Barre de filtres (RG-009-*, RG-010-*) : chips « Drafts » / « Mes MRs »,
 * pastilles des filtres composables actifs + bouton « Ajouter un filtre »,
 * compteur (RG-G20) et bouton « Effacer » — visible si un filtre composable
 * ou « Mes MRs » est actif. Purement présentationnel : reçoit l'état, émet
 * les intentions, ne recharge jamais lui-même.
 */
@Component({
  selector: 'app-filter-bar',
  imports: [
    FormsModule,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    TranslatePipe,
    AddFilterMenuComponent,
    FilterPillComponent,
  ],
  templateUrl: './filter-bar.component.html',
  styleUrl: './filter-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterBarComponent {
  private readonly i18n = inject(TranslateService);

  readonly drafts = input.required<boolean>();
  readonly mine = input.required<boolean>();
  readonly identityConfigured = input.required<boolean>();
  readonly rows = input.required<MergeRequestView[]>();
  readonly active = input.required<FilterKey[]>();
  readonly composableFilters = input.required<ComposableFilters>();
  readonly facets = input.required<MergeRequestsFacets | null>();
  /** RG-026-01 : recherche libre, `''` = aucune (toujours visible, pas une pastille). */
  readonly search = input.required<string>();
  /** RG-021-03 : transmis à `AddFilterMenuComponent`. */
  readonly showConnectionFilter = input(true);
  /** RG-025-09 : repos configurés, transmis à `FilterPillComponent` pour la pastille du filtre Projet. */
  readonly projects = input<Project[]>([]);

  readonly draftsToggle = output<void>();
  readonly mineToggle = output<void>();
  readonly clearFilters = output<void>();
  readonly filterAdd = output<FilterKey>();
  readonly filterRemove = output<FilterKey>();
  readonly filterToggleValue = output<{ key: FilterKey; value: string }>();
  readonly filterSelectBoolean = output<{ key: FilterKey; value: 'yes' | 'no' }>();
  /** RG-026-09 : émise à chaque frappe (l'appelant se charge du debounce). */
  readonly searchChange = output<string>();

  protected readonly countLabel = computed(() => {
    const parts = countLabelParts(this.rows());
    return this.i18n.translate('board.filters.count', {
      count: parts.count,
      countSuffix: parts.countSuffix,
      projects: parts.projects,
      projectsSuffix: parts.projectsSuffix,
    });
  });

  /** RG-026-11 : le bouton « Effacer » reste visible dès qu'une recherche est saisie. */
  protected readonly hasActiveFilter = computed(
    () => this.mine() || this.active().length > 0 || this.search().length > 0,
  );

  /** RG-026-11 : croix du champ — vide la recherche seule, sans toucher aux autres filtres. */
  protected clearSearch(): void {
    this.searchChange.emit('');
  }

  protected optionsFor(key: FilterKey): FacetOption[] {
    return this.facets()?.[key] ?? [];
  }

  protected multiValueFor(key: FilterKey): string[] {
    return isMultiValueFilter(key) ? this.composableFilters()[key] : [];
  }

  protected booleanValueFor(key: FilterKey): 'yes' | 'no' | null {
    return isMultiValueFilter(key) ? null : this.composableFilters()[key];
  }
}
