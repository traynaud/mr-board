import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslateService } from '../../core/i18n/translate.service';
import { MergeRequestsStore } from '../../stores/merge-requests.store';
import { ProjectsStore } from '../../stores/projects.store';
import { SettingsStore } from '../../stores/settings.store';
import { SyncStore } from '../../stores/sync.store';
import { BoardToolbarComponent } from './board-toolbar/board-toolbar.component';
import { MrTableComponent } from './mr-table/mr-table.component';

/** Durée d'affichage des toasts (ms), identique au reste de l'application. */
const TOAST_DURATION_MS = 3500;

/**
 * Écran Tableau (route `/`) : toolbar de synchronisation (US-004), bandeau
 * sans-jeton (RG-004-10), état vide sans-repo (RG-004-11), et tableau des
 * MRs ouvertes (US-005, RG-005-*).
 */
@Component({
  selector: 'app-board-page',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    RouterLink,
    TranslatePipe,
    BoardToolbarComponent,
    MrTableComponent,
  ],
  templateUrl: './board-page.component.html',
  styleUrl: './board-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardPageComponent implements OnInit {
  protected readonly settingsStore = inject(SettingsStore);
  protected readonly projectsStore = inject(ProjectsStore);
  protected readonly syncStore = inject(SyncStore);
  protected readonly mrStore = inject(MergeRequestsStore);
  private readonly snackBar = inject(MatSnackBar);
  private readonly i18n = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  /** `false` tant qu'aucun chargement de statut ne s'est encore terminé (pas de toast à l'ouverture, RG-004-12). */
  private initialized = false;
  private wasLoadingStatus = false;
  private lastToastedStartedAt: string | null = null;

  /** Sans jeton configuré (RG-004-10). `false` tant que les paramètres ne sont pas encore chargés. */
  protected readonly noToken = computed(() => {
    const settings = this.settingsStore.settings();
    return settings !== null && !settings.tokenConfigured;
  });

  /** Avec un jeton mais aucun repo (RG-004-11) ; le bandeau RG-004-10 prend le pas (mutuellement exclusifs). */
  protected readonly noRepos = computed(
    () =>
      !this.noToken() &&
      this.projectsStore.projects().length === 0 &&
      !this.projectsStore.loading(),
  );

  protected readonly refreshDisabled = computed(
    () => this.noToken() || this.syncStore.running(),
  );

  /** Jeton et repo configurés mais aucune MR ouverte (RG-005-08). */
  protected readonly noMergeRequests = computed(
    () =>
      !this.noToken() &&
      !this.noRepos() &&
      this.mrStore.mergeRequests().length === 0 &&
      !this.mrStore.loading(),
  );

  constructor() {
    // Toast d'erreur/partiel une fois la synchro terminée (RG-004-12), sans
    // re-déclencher au montage pour un échec déjà présent avant l'ouverture.
    // Se déclenche uniquement sur une transition loading(true → false) — pas
    // sur l'état par défaut du store à la construction du composant, qui
    // vaudrait aussi `loading: false` avant tout appel réseau.
    effect(() => {
      const loading = this.syncStore.loading();
      const lastRun = this.syncStore.lastRun();
      const justFinishedLoading = this.wasLoadingStatus && !loading;
      this.wasLoadingStatus = loading;
      if (!justFinishedLoading) {
        return;
      }
      if (!this.initialized) {
        this.initialized = true;
        this.lastToastedStartedAt = lastRun?.startedAt ?? null;
        return;
      }
      if (lastRun && lastRun.startedAt !== this.lastToastedStartedAt) {
        this.lastToastedStartedAt = lastRun.startedAt;
        if (lastRun.status === 'partial' || lastRun.status === 'error') {
          this.toast('board.sync.toastError');
        }
      }
      // Rechargement automatique des MRs à chaque fin de synchronisation,
      // quel que soit son statut (RG-005-06) — même transition que le toast
      // ci-dessus, sans polling dédié aux MRs elles-mêmes.
      void this.loadMergeRequests();
    });
  }

  ngOnInit(): void {
    void this.settingsStore.load();
    void this.projectsStore.load();
    void this.loadMergeRequests();
    this.syncStore.startPolling();
    this.destroyRef.onDestroy(() => this.syncStore.stopPolling());
  }

  /** Déclenché par le bouton Rafraîchir de la toolbar (RG-004-09). */
  protected refresh(): void {
    void this.syncStore.trigger();
  }

  /**
   * Charge les MRs et affiche un toast en cas d'échec (RG-005-07).
   * Contrairement au toast de synchro, pas de logique de "première fois" :
   * `load()` n'est appelé qu'à des points de déclenchement discrets
   * (ouverture de l'écran, fin de synchronisation), jamais par un polling
   * continu — un échec au tout premier appel doit légitimement toaster.
   */
  private async loadMergeRequests(): Promise<void> {
    await this.mrStore.load();
    if (this.mrStore.loadError()) {
      this.toast('board.mergeRequests.loadError');
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
