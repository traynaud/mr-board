import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslateService } from '../../core/i18n/translate.service';
import { LanguageService } from '../../core/language/language.service';
import { ThemeService } from '../../core/theme/theme.service';
import { encodeQueryParams } from '../../core/url-state/query-params.mapper';
import { SettingsSectionComponent } from '../../shared/settings-section/settings-section.component';
import { ColumnsStore } from '../../stores/columns.store';
import { ConnectionsStore } from '../../stores/connections.store';
import { FiltersStore } from '../../stores/filters.store';
import { MergeRequestsStore } from '../../stores/merge-requests.store';
import { ProjectsStore } from '../../stores/projects.store';
import { SettingsStore } from '../../stores/settings.store';
import { SyncStore } from '../../stores/sync.store';
import { syncIdentitiesFormArray } from './connections-form';
import { resolveMeIdentity } from './me-identity';
import { collectDirtyRepoChanges, syncReposFormArray } from './repos-form';
import { ConnectionsSectionComponent } from './sections/connections/connections-section.component';
import { IdentityRow, MeSectionComponent } from './sections/me/me-section.component';
import { RefreshSectionComponent } from './sections/refresh/refresh-section.component';
import { RepoRow } from './sections/repositories/repositories-section.component';
import { MiscellaneousSectionComponent } from './sections/miscellaneous/miscellaneous-section.component';
import { ThresholdsSectionComponent } from './sections/thresholds/thresholds-section.component';
import {
  buildSettingsForm,
  resetSettingsForm,
  resetSettingsFormToDefaults,
  toUpdateRequest,
} from './settings-form';
import { HasUnsavedChanges } from './unsaved-changes.guard';

/** Durée d'affichage des toasts (ms). */
export const TOAST_DURATION_MS = 3500;

const IDLE_TEST = { status: 'idle' as const, result: null, errorKey: null };

/**
 * Écran Paramètres (route `/settings`) : chargement, sections, Enregistrer /
 * Annuler. La confirmation d'abandon est gérée par `unsavedChangesGuard`.
 */
@Component({
  selector: 'app-settings-page',
  imports: [
    ReactiveFormsModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressBarModule,
    RouterLink,
    TranslatePipe,
    SettingsSectionComponent,
    ConnectionsSectionComponent,
    MeSectionComponent,
    RefreshSectionComponent,
    ThresholdsSectionComponent,
    MiscellaneousSectionComponent,
  ],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPageComponent implements OnInit, HasUnsavedChanges {
  protected readonly store = inject(SettingsStore);
  protected readonly projectsStore = inject(ProjectsStore);
  protected readonly connectionsStore = inject(ConnectionsStore);
  private readonly syncStore = inject(SyncStore);
  private readonly filtersStore = inject(FiltersStore);
  private readonly mrStore = inject(MergeRequestsStore);
  private readonly columnsStore = inject(ColumnsStore);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly i18n = inject(TranslateService);
  private readonly themeService = inject(ThemeService);
  private readonly languageService = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly form = buildSettingsForm();
  /** Signal réémis à chaque événement du formulaire (valeur, statut, pristine). */
  private readonly formEvents = toSignal(this.form.events);

  /**
   * Repos existants appariés à leur groupe de formulaire, par index
   * (RG-003-07). Publié par l'effect ci-dessous, qui reconstruit aussi
   * `form.controls.repos` dans le même mouvement : les deux restent toujours
   * en phase, sans dépendre de l'ordre d'exécution entre effects et computed.
   */
  protected readonly repoRows = signal<RepoRow[]>([]);

  protected readonly canSave = computed(() => {
    this.formEvents();
    return this.form.valid && this.form.dirty && !this.store.saving();
  });

  /** Une ligne d'identité résolue par connexion (RG-019-08), pour la section « 01 · Moi ». */
  protected readonly identityRows = computed<IdentityRow[]>(() => {
    this.formEvents();
    const testedConnectionId = this.connectionsStore.testedConnectionId();
    const test = this.connectionsStore.test();
    return this.connectionsStore.connections().map((connection, i) => {
      const group = this.form.controls.identities.at(i);
      return {
        connection,
        group,
        identity: resolveMeIdentity(
          group.controls.username.value,
          testedConnectionId === connection.id ? test : IDLE_TEST,
        ),
      };
    });
  });

  constructor() {
    // RG-018-03 : restaure le thème enregistré à la sortie de l'écran, que
    // ce soit via Annuler, une navigation directe ou l'abandon confirmé par
    // le guard (RG-001-07) — la destruction du composant suffit dans tous
    // les cas, sans logique dédiée dans `cancel()`.
    this.destroyRef.onDestroy(() => this.themeService.clearPreview());
    this.destroyRef.onDestroy(() => this.languageService.clearPreview());
    effect(() => {
      const settings = this.store.settings();
      if (settings && this.form.pristine) {
        resetSettingsForm(this.form, settings);
      }
    });
    // Reconstruit inconditionnellement le FormArray des alias à chaque
    // changement de la liste des repos (ajout/suppression immédiats,
    // renommage sauvegardé) — RG-003-07 : une modification d'alias non
    // enregistrée sur une autre ligne est perdue si la liste change entre
    // temps (cas rare, assumé).
    effect(() => {
      const projects = this.projectsStore.projects();
      syncReposFormArray(this.form.controls.repos, projects);
      this.repoRows.set(
        projects.map((project, i) => ({
          project,
          group: this.form.controls.repos.at(i),
        })),
      );
    });
    // Reconstruit le FormArray des identités à chaque changement de la liste
    // des connexions (ajout/suppression immédiats, RG-019-08) — même
    // principe que pour les repos.
    effect(() => {
      syncIdentitiesFormArray(this.form.controls.identities, this.connectionsStore.connections());
    });
  }

  ngOnInit(): void {
    void this.store.load();
    // `ConnectionsStore`/`ProjectsStore` sont chargés par `ConnectionsSectionComponent`
    // (US-021 §0 : les repos vivent désormais dans ses cartes de connexion
    // dépliées) — jamais ici, pour éviter un chargement redondant du même
    // singleton.
  }

  /** Contrat du guard d'abandon (RG-001-07). */
  hasUnsavedChanges(): boolean {
    return this.form.dirty;
  }

  protected retry(): void {
    void this.store.load();
  }

  protected async save(): Promise<void> {
    if (!this.canSave()) {
      return;
    }
    const settingsError = await this.store.save(toUpdateRequest(this.form));
    if (settingsError) {
      this.toast('settings.saveError');
      return;
    }
    // Fire-and-forget (RG-004-15) : ne bloque ni le toast ni la navigation
    // ci-dessous, et son échec éventuel est ignoré (voir SyncStore.trigger).
    void this.syncStore.trigger();
    const repoChanges = collectDirtyRepoChanges(this.form.controls.repos);
    const renameErrors = await Promise.all(
      repoChanges.map((change) =>
        this.projectsStore.rename(change.id, { alias: change.alias, color: change.color }),
      ),
    );
    if (renameErrors.some((error) => error !== null)) {
      // Les paramètres sont déjà enregistrés côté serveur ; le formulaire
      // reste modifié pour ne perdre aucune saisie (spec §6, « Modifier un
      // alias vers un doublon »). Un nouveau clic sur Enregistrer relance
      // les deux étapes ; renvoyer PUT /settings est sans effet indésirable.
      this.toast('settings.saveError');
      return;
    }
    // Explicite (en plus de l'effect) pour que le formulaire soit
    // immédiatement pristine avant la navigation, sans dépendre du moment où
    // l'effect sera exécuté.
    syncReposFormArray(this.form.controls.repos, this.projectsStore.projects());
    syncIdentitiesFormArray(this.form.controls.identities, this.connectionsStore.connections());
    const settings = this.store.settings();
    if (settings) {
      resetSettingsForm(this.form, settings);
    }
    this.toast('settings.saved');
    await this.router.navigate(['/'], { queryParams: this.boardQueryParams() });
  }

  protected cancel(): void {
    void this.router.navigate(['/'], { queryParams: this.boardQueryParams() });
  }

  /** RG-015-05 : remet tout le formulaire aux valeurs par défaut, sans rien enregistrer. */
  protected resetToDefaults(): void {
    resetSettingsFormToDefaults(this.form);
    this.toast('settings.reset.done');
  }

  /**
   * RG-011-05 : reconstruit la query string du tableau à partir de ses
   * stores (`FiltersStore`/`MergeRequestsStore`/`ColumnsStore` sont
   * `providedIn: 'root'`, donc leur état survit à la navigation vers cet
   * écran — pas besoin d'un registre séparé « dernière URL »).
   */
  protected boardQueryParams(): Record<string, string> {
    return encodeQueryParams({
      drafts: this.filtersStore.drafts(),
      mine: this.filtersStore.mine(),
      active: this.filtersStore.active(),
      connection: this.filtersStore.connection(),
      project: this.filtersStore.project(),
      author: this.filtersStore.author(),
      assigned: this.filtersStore.assigned(),
      approved: this.filtersStore.approved(),
      commented: this.filtersStore.commented(),
      search: this.filtersStore.search(),
      sort: this.mrStore.sort(),
      showStatus: this.columnsStore.showStatus(),
      showOpened: this.columnsStore.showOpened(),
    });
  }

  private toast(key: string): void {
    this.snackBar.open(this.i18n.translate(key), this.i18n.translate('common.ok'), {
      duration: TOAST_DURATION_MS,
      horizontalPosition: 'start',
      panelClass: 'mrb-toast',
    });
  }
}
