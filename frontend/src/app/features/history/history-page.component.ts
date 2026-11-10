import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslateService } from '../../core/i18n/translate.service';
import {
  decodeHistoryQuery,
  encodeHistoryQuery,
  hasAnyHistoryFilter,
} from '../../core/url-state/history-query-params';
import { HistoryEventType, HistoryFilterKey } from '../../models/history.model';
import { formatShortDate } from '../../shared/format/format-date';
import { projectTagStyle } from '../../shared/project-color/project-tag-style';
import { HistoryStore } from '../../stores/history.store';
import { ProjectsStore } from '../../stores/projects.store';
import { SettingsStore } from '../../stores/settings.store';
import { groupByDay, localDayOf } from './group-by-day';
import { HistoryEventRowComponent } from '../../shared/history-event-row/history-event-row.component';
import { HistoryFilterBarComponent } from './history-filter-bar/history-filter-bar.component';
import { HistoryPeriod } from './history-period-pill/history-period-pill.component';

/**
 * Page « Historique » (US-037) : timeline des modifications de MRs, du plus récent au plus ancien,
 * filtrable (US-038) ; les filtres sont reflétés dans l'URL (RG-038-03, RG-038-14).
 */
@Component({
  selector: 'app-history-page',
  imports: [
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
    RouterLink,
    TranslatePipe,
    HistoryEventRowComponent,
    HistoryFilterBarComponent,
  ],
  templateUrl: './history-page.component.html',
  styleUrl: './history-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryPageComponent implements OnInit {
  protected readonly store = inject(HistoryStore);
  private readonly projects = inject(ProjectsStore);
  private readonly settings = inject(SettingsStore);
  private readonly i18n = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly projectList = this.projects.projects;
  protected readonly hasFilter = computed(() => hasAnyHistoryFilter(this.store.filters()));

  constructor() {
    // RG-038-03 : l'état des filtres est recopié dans l'URL (sans empiler l'historique de navigation).
    effect(() => {
      const queryParams = encodeHistoryQuery(this.store.filters());
      untracked(() => {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams,
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      });
    });
  }

  /** Groupes par jour avec leur titre localisé (« Aujourd'hui », « Hier » ou date courte). */
  protected readonly groups = computed(() => {
    const today = localDayOf(new Date().toISOString());
    const yesterday = localDayOf(new Date(Date.now() - 86_400_000).toISOString());
    const language = this.i18n.language();
    return groupByDay(this.store.events()).map((group) => ({
      ...group,
      label:
        group.day === today
          ? this.i18n.translate('history.today')
          : group.day === yesterday
            ? this.i18n.translate('history.yesterday')
            : formatShortDate(group.day, language),
    }));
  });

  private readonly colorByProjectId = computed(
    () => new Map(this.projects.projects().map((p) => [p.id, p.color])),
  );

  ngOnInit(): void {
    this.store.restoreFilters(decodeHistoryQuery(this.route.snapshot.queryParams));
    void this.store.load();
    void this.store.loadActors();
    // Le thème (ThemeService) se déduit des paramètres : sans ce chargement, un accès direct à l'historique
    // sans cache local (RG-018-05) s'afficherait en thème clair malgré une préférence sombre.
    if (this.settings.settings() === null) {
      void this.settings.load();
    }
    if (this.projects.projects().length === 0) {
      void this.projects.load();
    }
  }

  protected tagStyleOf(projectId: number) {
    return projectTagStyle(this.colorByProjectId().get(projectId), false);
  }

  protected retry(): void {
    void this.store.load();
  }

  protected loadMore(): void {
    void this.store.loadMore();
  }

  protected onSearch(search: string): void {
    void this.store.setSearch(search);
  }

  protected onToggleType(type: HistoryEventType): void {
    void this.store.toggleType(type);
  }

  protected onToggleActor(username: string): void {
    void this.store.toggleActor(username);
  }

  protected onToggleProject(projectId: number): void {
    void this.store.toggleProject(projectId);
  }

  protected onPeriod(period: HistoryPeriod): void {
    void this.store.setPeriod(period.from, period.to);
  }

  protected onFilterAdd(key: HistoryFilterKey): void {
    this.store.addFilter(key);
  }

  protected onFilterRemove(key: HistoryFilterKey): void {
    void this.store.removeFilter(key);
  }

  protected clearFilters(): void {
    void this.store.clearFilters();
  }
}
