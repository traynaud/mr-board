import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TranslateService } from '../../../core/i18n/translate.service';
import { HISTORY_SEARCH_MAX_LENGTH } from '../../../core/url-state/history-query-params';
import {
  HISTORY_EVENT_TYPES,
  HISTORY_FILTER_KEYS,
  HistoryActorOption,
  HistoryEventType,
  HistoryFilterKey,
  HistoryFilters,
  UNKNOWN_ACTOR,
} from '../../../models/history.model';
import { Project } from '../../../models/project.model';
import { findProjectColor } from '../../../shared/project-color/project-color-palette';
import { HistoryFilterOption, HistoryFilterPillComponent } from '../history-filter-pill/history-filter-pill.component';
import { HistoryPeriod, HistoryPeriodPillComponent } from '../history-period-pill/history-period-pill.component';

/** Anti-rebond de la recherche (RG-026-09, RG-038-05). */
export const HISTORY_SEARCH_DEBOUNCE_MS = 300;

/** Au-delà de ce nombre de projets, le menu Projet propose un champ de recherche. */
const PROJECT_SEARCH_THRESHOLD = 8;

/**
 * Barre de filtres de la page Historique (US-038, RG-038-*) : recherche, pastilles actives,
 * « + Ajouter un filtre » et « Effacer ». Purement présentationnelle : reçoit l'état, émet les
 * intentions, ne charge rien.
 */
@Component({
  selector: 'app-history-filter-bar',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    TranslatePipe,
    HistoryFilterPillComponent,
    HistoryPeriodPillComponent,
  ],
  templateUrl: './history-filter-bar.component.html',
  styleUrl: './history-filter-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryFilterBarComponent {
  private readonly i18n = inject(TranslateService);

  readonly filters = input.required<HistoryFilters>();
  readonly activeKeys = input.required<HistoryFilterKey[]>();
  readonly actors = input.required<HistoryActorOption[]>();
  readonly projects = input.required<Project[]>();
  /** Vrai dès qu'un filtre ou la recherche a une valeur : affiche « Effacer ». */
  readonly hasFilter = input.required<boolean>();

  readonly searchChange = output<string>();
  readonly toggleType = output<HistoryEventType>();
  readonly toggleActor = output<string>();
  readonly toggleProject = output<number>();
  readonly periodChange = output<HistoryPeriod>();
  readonly filterAdd = output<HistoryFilterKey>();
  readonly filterRemove = output<HistoryFilterKey>();
  readonly clearFilters = output<void>();

  protected readonly filterKeys = HISTORY_FILTER_KEYS;
  protected readonly searchMaxLength = HISTORY_SEARCH_MAX_LENGTH;

  /** Saisie en cours, resynchronisée quand la recherche change de l'extérieur (URL, « Effacer »). */
  protected readonly draft = linkedSignal(() => this.filters().search);

  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancelTimer());
  }

  protected readonly typeOptions = computed<HistoryFilterOption[]>(() =>
    HISTORY_EVENT_TYPES.map((type) => ({
      value: type,
      label: this.i18n.translate(`settings.notifications.types.labels.${type}`),
    })),
  );

  protected readonly actorOptions = computed<HistoryFilterOption[]>(() => [
    { value: UNKNOWN_ACTOR, label: this.i18n.translate('history.unknownActor') },
    ...this.actors().map((actor) => ({
      value: actor.username,
      label: actor.name ?? actor.username,
      sublabel: actor.name ? `@${actor.username}` : undefined,
    })),
  ]);

  protected readonly projectOptions = computed<HistoryFilterOption[]>(() =>
    this.projects().map((project) => ({
      value: String(project.id),
      label: project.alias,
      swatch: findProjectColor(project.color),
    })),
  );

  protected readonly selectedProjects = computed(() => this.filters().projects.map(String));
  protected readonly projectsSearchable = computed(() => this.projects().length > PROJECT_SEARCH_THRESHOLD);

  protected nameFor(key: HistoryFilterKey): string {
    return this.i18n.translate(`history.filters.names.${key}`);
  }

  protected isActive(key: HistoryFilterKey): boolean {
    return this.activeKeys().includes(key);
  }

  protected onSearchInput(value: string): void {
    this.draft.set(value);
    this.cancelTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.searchChange.emit(value);
    }, HISTORY_SEARCH_DEBOUNCE_MS);
  }

  protected onTypeToggled(value: string): void {
    this.toggleType.emit(value as HistoryEventType);
  }

  protected onProjectToggled(value: string): void {
    this.toggleProject.emit(Number(value));
  }

  private cancelTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
