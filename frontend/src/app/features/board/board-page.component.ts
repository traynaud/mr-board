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
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslateService } from '../../core/i18n/translate.service';
import { ThemeService } from '../../core/theme/theme.service';
import {
  decodeQueryParams,
  encodeQueryParams,
  normalizeParams,
} from '../../core/url-state/query-params.mapper';
import { FilterKey } from '../../models/merge-request.model';
import { ColumnWidthsStore, ResizableColumnKey } from '../../stores/column-widths.store';
import { ColumnsStore } from '../../stores/columns.store';
import { ConnectionsStore } from '../../stores/connections.store';
import { FiltersStore } from '../../stores/filters.store';
import { MergeRequestsStore } from '../../stores/merge-requests.store';
import { ProjectsStore } from '../../stores/projects.store';
import { SettingsStore } from '../../stores/settings.store';
import { SyncStore } from '../../stores/sync.store';
import { BoardToolbarComponent } from './board-toolbar/board-toolbar.component';
import { FilterBarComponent } from './filter-bar/filter-bar.component';
import { MrTableComponent } from './mr-table/mr-table.component';
import { computeSyncFailureDetail } from './sync-status-label';

/** Durée d'affichage des toasts (ms), identique au reste de l'application. */
const TOAST_DURATION_MS = 3500;

/** Titre par défaut de l'onglet, restauré à la destruction du composant (RG-016-04). */
const APP_TITLE = 'MR Board';

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
    FilterBarComponent,
    MrTableComponent,
  ],
  templateUrl: './board-page.component.html',
  styleUrl: './board-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardPageComponent implements OnInit {
  protected readonly settingsStore = inject(SettingsStore);
  protected readonly connectionsStore = inject(ConnectionsStore);
  protected readonly projectsStore = inject(ProjectsStore);
  protected readonly syncStore = inject(SyncStore);
  protected readonly mrStore = inject(MergeRequestsStore);
  protected readonly filtersStore = inject(FiltersStore);
  protected readonly columnsStore = inject(ColumnsStore);
  protected readonly columnWidthsStore = inject(ColumnWidthsStore);
  private readonly themeService = inject(ThemeService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly i18n = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly titleService = inject(Title);

  /** `false` tant qu'aucun chargement de statut ne s'est encore terminé (pas de toast à l'ouverture, RG-004-12). */
  private initialized = false;
  private wasLoadingStatus = false;
  private lastToastedStartedAt: string | null = null;
  /** Vrai si le polling a été arrêté par ce listener (et non par `ngOnDestroy`), pour ne redémarrer que ce qu'on a nous-même mis en pause. */
  private pausedByVisibility = false;

  /** Aucune connexion configurée du tout (RG-019-17). `false` tant qu'elles ne sont pas encore chargées. */
  protected readonly noConnections = computed(
    () => this.connectionsStore.connections().length === 0 && !this.connectionsStore.loading(),
  );

  /** Au moins une connexion sans jeton (RG-019-17), listées par nom dans le bandeau. */
  protected readonly connectionsWithoutToken = computed(() =>
    this.connectionsStore.connections().filter((c) => !c.tokenConfigured),
  );

  protected readonly connectionsWithoutTokenNames = computed(() =>
    this.connectionsWithoutToken()
      .map((c) => c.name)
      .join(', '),
  );

  /** RG-021-01/03/08 : icône de forge, filtre « Connexion » et notifications ne s'affichent qu'à partir de 2 connexions. */
  protected readonly hasMultipleConnections = computed(
    () => this.connectionsStore.connections().length > 1,
  );

  /** RG-021-01 : l'icône de forge n'apparaît que si au moins deux types de forge sont configurés. */
  protected readonly hasMultipleForgeTypes = computed(
    () => new Set(this.connectionsStore.connections().map((c) => c.type)).size > 1,
  );

  /** RG-021-06 : détail des repos en échec du dernier run, pour le tooltip du libellé de synchro. */
  protected readonly syncFailureDetail = computed(() =>
    computeSyncFailureDetail(this.syncStore.lastRun()),
  );

  /** Avec des connexions mais aucun repo (RG-004-11) ; le bandeau RG-019-17 prend le pas (mutuellement exclusifs). */
  protected readonly noRepos = computed(
    () =>
      !this.noConnections() &&
      this.projectsStore.projects().length === 0 &&
      !this.projectsStore.loading(),
  );

  /** RG-019-17 : « Rafraîchir » n'est désactivé que sans aucune connexion, pas quand une seule manque de jeton. */
  protected readonly refreshDisabled = computed(
    () => this.noConnections() || this.syncStore.running(),
  );

  /** Connexions et repo configurés mais aucune MR ouverte (RG-005-08). */
  protected readonly noMergeRequests = computed(
    () =>
      !this.noConnections() &&
      !this.noRepos() &&
      this.mrStore.mergeRequests().length === 0 &&
      !this.mrStore.loading(),
  );

  /** Identité configurée (RG-002-05, RG-019-09) : active le chip « Mes MRs » (RG-009-03). */
  protected readonly identityConfigured = computed(() => {
    const settings = this.settingsStore.settings();
    return (
      !!settings?.meEmail || this.connectionsStore.connections().some((c) => !!c.meUsername)
    );
  });

  /**
   * « Mes MRs » et les filtres composables sont les seuls vrais filtres
   * (RG-009-05, RG-010-10) : « Drafts » est une préférence d'affichage.
   * Détermine le texte de l'état vide et la visibilité du bouton
   * « Effacer les filtres ».
   */
  protected readonly hasActiveFilter = computed(
    () => this.filtersStore.mine() || this.filtersStore.active().length > 0,
  );

  /** RG-011-01/06 : query params courants (filtres + tri + colonnes), ordre stable. */
  protected readonly currentQueryParams = computed(() =>
    encodeQueryParams({
      drafts: this.filtersStore.drafts(),
      mine: this.filtersStore.mine(),
      active: this.filtersStore.active(),
      connection: this.filtersStore.connection(),
      project: this.filtersStore.project(),
      author: this.filtersStore.author(),
      assigned: this.filtersStore.assigned(),
      approved: this.filtersStore.approved(),
      commented: this.filtersStore.commented(),
      sort: this.mrStore.sort(),
      showStatus: this.columnsStore.showStatus(),
      showOpened: this.columnsStore.showOpened(),
    }),
  );

  /**
   * RG-011-06 : query string affichée en pied de page, au format canonique
   * de RG-011-01 (`key=value&…`) — pas `URLSearchParams.toString()`, qui
   * encode `:` en `%3A` et romprait la correspondance littérale avec le
   * format documenté (ex. `sort=ready:asc`).
   */
  protected readonly currentQueryString = computed(() => {
    const params = this.currentQueryParams();
    return `?${Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join('&')}`;
  });

  /** RG-011-06 : pied de page visible sur l'écran Tableau, hors état « pas de repo » et chargement initial. */
  protected readonly showFooter = computed(
    () => !this.noRepos() && !(this.mrStore.loading() && this.mrStore.mergeRequests().length === 0),
  );

  /** RG-016-04 : nombre de MRs affichées au niveau Ready rouge, pour le badge du titre d'onglet. */
  protected readonly redCount = computed(
    () => this.mrStore.mergeRequests().filter((mr) => mr.readyLevel === 'red').length,
  );

  /** RG-018-12 : icône et clé i18n de l'infobulle de la bascule rapide, indiquant la destination du clic. */
  protected readonly themeIcon = computed<'sun' | 'moon'>(() =>
    this.themeService.effective() === 'dark' ? 'sun' : 'moon',
  );
  protected readonly themeToggleLabelKey = computed(() =>
    this.themeService.effective() === 'dark' ? 'board.toolbar.themeToLight' : 'board.toolbar.themeToDark',
  );

  /** RG-023-11 : pied de page mentionnant l'anneau « moi » uniquement quand `highlightMe` est actif. */
  protected readonly footerLegendKey = computed(() =>
    this.settingsStore.settings()?.highlightMe ? 'board.footer.legendHighlighted' : 'board.footer.legend',
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
          this.toastSyncFailure(lastRun.status, lastRun.errorMessage);
        }
      }
      // Rechargement automatique des MRs à chaque fin de synchronisation,
      // quel que soit son statut (RG-005-06) — même transition que le toast
      // ci-dessus, sans polling dédié aux MRs elles-mêmes.
      void this.loadMergeRequests();
    });

    // RG-011-02/03/07 : réécrit l'URL (sans empiler d'historique) à chaque
    // changement de filtre/tri/colonne — couvre uniformément tous les
    // handlers existants (dont « Effacer ») sans code dédié dans chacun.
    effect(() => {
      const queryParams = this.currentQueryParams();
      void this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true });
    });

    // RG-016-04 : badge de comptage des MRs rouges dans le titre de l'onglet.
    // L'effect s'arrête à la destruction du composant, mais le dernier titre
    // posé resterait sinon affiché en naviguant vers /settings : restauré
    // explicitement.
    effect(() => {
      const settings = this.settingsStore.settings();
      if (!settings?.tabBadge) {
        this.titleService.setTitle(APP_TITLE);
        return;
      }
      const count = this.redCount();
      this.titleService.setTitle(count > 0 ? `(${count}) ${APP_TITLE}` : APP_TITLE);
    });
    this.destroyRef.onDestroy(() => this.titleService.setTitle(APP_TITLE));
  }

  ngOnInit(): void {
    this.restoreFromUrl();
    void this.settingsStore.load();
    void this.connectionsStore.load();
    void this.projectsStore.load();
    void this.loadMergeRequests();
    this.syncStore.startPolling();
    this.destroyRef.onDestroy(() => this.syncStore.stopPolling());
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.destroyRef.onDestroy(() =>
      document.removeEventListener('visibilitychange', this.onVisibilityChange),
    );
  }

  /**
   * RG-013-05 : suspend le polling de statut quand l'onglet est masqué (si
   * `pauseWhenHidden`, `true` par défaut) et relit immédiatement le statut au
   * retour — `startPolling()` déclenche un `loadStatus()` immédiat, dont la
   * transition loading true→false relance déjà `loadMergeRequests()` via
   * l'effect RG-005-06 ci-dessus : pas d'appel explicite séparé nécessaire
   * (sinon double rechargement). Avant le premier chargement des paramètres,
   * `settings()` est `null` : traité comme « pas de pause » plutôt que de
   * risquer une suspension non voulue (voir archi.md, points de vigilance).
   */
  private readonly onVisibilityChange = (): void => {
    const pauseWhenHidden = this.settingsStore.settings()?.pauseWhenHidden ?? false;
    if (!pauseWhenHidden) {
      return;
    }
    if (document.hidden) {
      this.pausedByVisibility = true;
      this.syncStore.stopPolling();
    } else if (this.pausedByVisibility) {
      this.pausedByVisibility = false;
      this.syncStore.startPolling();
    }
  };

  /** Déclenché par le bouton Rafraîchir de la toolbar (RG-004-09). */
  protected refresh(): void {
    void this.syncStore.trigger();
  }

  /** RG-018-12 : bascule rapide clair/sombre, persistée immédiatement en tâche de fond. */
  protected async onThemeToggle(): Promise<void> {
    const errorKey = await this.themeService.quickToggle();
    if (errorKey) {
      this.toast(errorKey);
    }
  }

  /** RG-009-01/07 : bascule « Drafts » puis recharge (débounce dans le store). */
  protected onDraftsToggle(): void {
    this.filtersStore.toggleDrafts();
    this.mrStore.scheduleReload();
  }

  /** RG-009-02/07. */
  protected onMineToggle(): void {
    this.filtersStore.toggleMine();
    this.mrStore.scheduleReload();
  }

  /** RG-009-05/07, RG-010-11 : réinitialise « Mes MRs » et les 5 filtres composables. */
  protected onClearFilters(): void {
    this.filtersStore.clear();
    this.mrStore.scheduleReload();
  }

  /** RG-010-03 : crée la pastille d'un filtre et recharge. */
  protected onFilterAdd(key: FilterKey): void {
    this.filtersStore.addFilter(key);
    this.mrStore.scheduleReload();
  }

  /** RG-010-04 : retire la pastille d'un filtre et recharge. */
  protected onFilterRemove(key: FilterKey): void {
    this.filtersStore.removeFilter(key);
    this.mrStore.scheduleReload();
  }

  /** RG-010-05 : bascule une valeur d'un filtre multi-sélection et recharge. */
  protected onFilterToggleValue(event: { key: FilterKey; value: string }): void {
    if (
      event.key === 'connection' ||
      event.key === 'project' ||
      event.key === 'author' ||
      event.key === 'assigned'
    ) {
      this.filtersStore.toggleMultiValue(event.key, event.value);
      this.mrStore.scheduleReload();
    }
  }

  /** RG-010-06 : choisit (ou désélectionne) une valeur d'un filtre booléen et recharge. */
  protected onFilterSelectBoolean(event: { key: FilterKey; value: 'yes' | 'no' }): void {
    if (event.key === 'approved' || event.key === 'commented') {
      this.filtersStore.setBoolean(event.key, event.value);
      this.mrStore.scheduleReload();
    }
  }

  /**
   * RG-017-09 : bascule la colonne « Statut ». Purement local — ne recharge
   * pas les MRs (aucun paramètre API concerné).
   */
  protected onToggleStatusColumn(): void {
    this.columnsStore.toggleStatus();
  }

  /**
   * RG-011-09 : bascule la colonne « Date d'ouverture ». Purement local — ne
   * recharge pas les MRs (aucun paramètre API concerné).
   */
  protected onToggleOpenedColumn(): void {
    this.columnsStore.toggleOpened();
  }

  /** RG-012-01/07 : nouvelle largeur (glisser ou clavier) pour une colonne. */
  protected onWidthChange(event: { key: ResizableColumnKey; width: number }): void {
    this.columnWidthsStore.setWidth(event.key, event.width);
  }

  /** RG-012-04 : double-clic sur une poignée, une seule colonne. */
  protected onResetColumnWidth(key: ResizableColumnKey): void {
    this.columnWidthsStore.resetOne(key);
  }

  /** RG-012-04/05 : item de menu « Réinitialiser les largeurs ». */
  protected onResetAllWidths(): void {
    this.columnWidthsStore.resetAll();
  }

  /**
   * RG-011-02 : restaure filtres/tri/colonnes depuis l'URL au chargement, en
   * un seul instantané (`snapshot`, jamais un abonnement réactif — sinon la
   * propre écriture de l'effet de synchronisation redéclencherait une
   * décodification à chaque changement, voir archi.md). Doit s'exécuter
   * avant le premier `loadMergeRequests()` pour que celui-ci parte de l'état
   * restauré plutôt que des valeurs par défaut.
   */
  private restoreFromUrl(): void {
    const raw = normalizeParams(this.route.snapshot.queryParams);
    const state = decodeQueryParams(raw);
    this.filtersStore.restore({
      drafts: state.drafts,
      mine: state.mine,
      active: state.active,
      connection: state.connection,
      project: state.project,
      author: state.author,
      assigned: state.assigned,
      approved: state.approved,
      commented: state.commented,
    });
    this.mrStore.restoreSort(state.sort);
    this.columnsStore.restore(state.showStatus, state.showOpened);
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
    this.toastText(this.i18n.translate(key));
  }

  /**
   * RG-021-06 : toast de fin de synchro `partial`/`error`, préfixé du statut
   * et suivi de `lastRun.errorMessage` — déjà nommé par connexion/repo côté
   * backend (RG-019-16, RG-020-*), jamais retraduit ici.
   */
  private toastSyncFailure(status: 'partial' | 'error', errorMessage: string | null): void {
    const prefixKey = status === 'partial' ? 'board.sync.toastPartial' : 'board.sync.toastError';
    const prefix = this.i18n.translate(prefixKey);
    this.toastText(errorMessage ? `${prefix} ${errorMessage}` : prefix);
  }

  private toastText(text: string): void {
    this.snackBar.open(text, this.i18n.translate('common.ok'), {
      duration: TOAST_DURATION_MS,
      horizontalPosition: 'start',
      panelClass: 'mrb-toast',
    });
  }
}
