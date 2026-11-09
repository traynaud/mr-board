import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TranslateService } from '../../../core/i18n/translate.service';
import { formatCounter } from '../../../shared/format/format-counter';
import { HistoryEventRowComponent } from '../../../shared/history-event-row/history-event-row.component';
import { projectTagStyle } from '../../../shared/project-color/project-tag-style';
import { NotificationsStore } from '../../../stores/notifications.store';
import { ProjectsStore } from '../../../stores/projects.store';

/** Durée d'affichage des toasts (ms), identique au reste de l'application. */
const TOAST_DURATION_MS = 3500;

/**
 * Panneau de notifications (US-040), ouvert en tiroir à droite de l'écran
 * Tableau : événements non vus, fermeture unitaire ou groupée (RG-040-02).
 * Les lignes sont celles de la timeline (`HistoryEventRowComponent`).
 */
@Component({
  selector: 'app-notifications-panel',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
    RouterLink,
    TranslatePipe,
    HistoryEventRowComponent,
  ],
  templateUrl: './notifications-panel.component.html',
  styleUrl: './notifications-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsPanelComponent implements OnInit {
  protected readonly store = inject(NotificationsStore);
  private readonly projects = inject(ProjectsStore);
  private readonly dialogRef = inject(MatDialogRef<NotificationsPanelComponent>);
  private readonly snackBar = inject(MatSnackBar);
  private readonly i18n = inject(TranslateService);

  /** Compteur plafonné à « 99+ » (RG-040-03). */
  protected readonly badge = computed(() => formatCounter(this.store.count()));

  /** Vrai quand des entrées ne sont pas listées (RG-040-07). */
  protected readonly hasHidden = computed(() => this.store.count() > this.store.events().length);

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

  protected close(): void {
    this.dialogRef.close();
  }

  protected retry(): void {
    void this.store.load();
  }

  /** Marque une entrée comme vue ; restaurée avec un toast si l'appel échoue (RG-040-04). */
  protected async markSeen(id: number): Promise<void> {
    if ((await this.store.dismiss(id)) !== null) {
      this.toast('notifications.error.markSeen');
    }
  }

  /** « Tout marquer comme vu » (RG-040-02). */
  protected async markAllSeen(): Promise<void> {
    if ((await this.store.dismissAll()) !== null) {
      this.toast('notifications.error.markSeen');
    }
  }

  private toast(key: string): void {
    this.snackBar.open(this.i18n.translate(key), this.i18n.translate('common.ok'), {
      duration: TOAST_DURATION_MS,
      horizontalPosition: 'start',
      panelClass: 'mrb-toast',
    });
  }
}
