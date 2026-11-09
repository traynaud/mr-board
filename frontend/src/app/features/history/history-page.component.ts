import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslateService } from '../../core/i18n/translate.service';
import { formatShortDate } from '../../shared/format/format-date';
import { projectTagStyle } from '../../shared/project-color/project-tag-style';
import { HistoryStore } from '../../stores/history.store';
import { ProjectsStore } from '../../stores/projects.store';
import { groupByDay, localDayOf } from './group-by-day';
import { HistoryEventRowComponent } from '../../shared/history-event-row/history-event-row.component';

/** Page « Historique » (US-037) : timeline des modifications de MRs, du plus récent au plus ancien. */
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
  ],
  templateUrl: './history-page.component.html',
  styleUrl: './history-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryPageComponent implements OnInit {
  protected readonly store = inject(HistoryStore);
  private readonly projects = inject(ProjectsStore);
  private readonly i18n = inject(TranslateService);

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
    void this.store.load();
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
}
