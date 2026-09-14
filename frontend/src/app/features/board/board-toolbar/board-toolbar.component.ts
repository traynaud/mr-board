import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TranslateService } from '../../../core/i18n/translate.service';
import { SyncRun } from '../../../models/sync-status.model';
import { AppLogoComponent } from '../../../shared/app-logo/app-logo.component';
import { computeNextRunTooltip, computeSyncStatusLabel } from '../sync-status-label';

/** Fréquence de recalcul du libellé relatif (« il y a N min »), RG-004-08. */
const LABEL_TICK_MS = 30_000;

/**
 * Toolbar de l'écran Tableau : marque, statut de synchronisation (recalculé
 * localement toutes les 30 s sans appel réseau), bouton Rafraîchir et accès
 * aux paramètres. Purement présentationnel : l'état vient de `SyncStore` via
 * `BoardPageComponent` (RG-004-08, RG-004-09).
 */
@Component({
  selector: 'app-board-toolbar',
  imports: [
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
    RouterLink,
    TranslatePipe,
    AppLogoComponent,
  ],
  templateUrl: './board-toolbar.component.html',
  styleUrl: './board-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardToolbarComponent implements OnDestroy {
  private readonly i18n = inject(TranslateService);

  readonly running = input.required<boolean>();
  readonly lastRun = input.required<SyncRun | null>();
  /** Prochaine échéance planifiée, `null` en mode manuel (RG-013-07). */
  readonly nextRunAt = input<string | null>(null);
  /** Détail des repos en échec du dernier run `partial`/`error` (RG-021-06). */
  readonly failureDetail = input<string | null>(null);
  /** Désactivé sans jeton configuré ou pendant une synchronisation (RG-004-09, RG-004-10). */
  readonly refreshDisabled = input<boolean>(false);
  readonly refresh = output<void>();

  /** Icône de la bascule rapide (RG-018-12) : indique la destination, pas l'état courant. */
  readonly themeIcon = input.required<'sun' | 'moon'>();
  readonly themeToggleLabel = input.required<string>();
  readonly themeToggle = output<void>();

  private readonly nowTick = signal(Date.now());
  private readonly tickHandle = setInterval(
    () => this.nowTick.set(Date.now()),
    LABEL_TICK_MS,
  );

  protected readonly label = computed(() =>
    computeSyncStatusLabel(
      { running: this.running(), lastRun: this.lastRun() },
      this.nowTick(),
    ),
  );

  protected readonly nextRunTooltip = computed(() => computeNextRunTooltip(this.nextRunAt()));

  /**
   * RG-021-06 : le détail des repos en échec prime sur l'infobulle
   * « prochaine synchro » (RG-013-07) quand il y en a un — texte déjà
   * assemblé côté backend, jamais une clé i18n.
   */
  protected readonly syncTooltip = computed(() => {
    const failure = this.failureDetail();
    if (failure) {
      return failure;
    }
    const tooltip = this.nextRunTooltip();
    return this.i18n.translate(tooltip.key, tooltip.params ?? {});
  });

  ngOnDestroy(): void {
    clearInterval(this.tickHandle);
  }
}
