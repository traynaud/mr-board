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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { merge } from 'rxjs';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslateService } from '../../core/i18n/translate.service';
import { encodeQueryParams } from '../../core/url-state/query-params.mapper';
import { SettingsSectionComponent } from '../../shared/settings-section/settings-section.component';
import { ColumnsStore } from '../../stores/columns.store';
import { FiltersStore } from '../../stores/filters.store';
import { MergeRequestsStore } from '../../stores/merge-requests.store';
import { ProjectsStore } from '../../stores/projects.store';
import { SettingsStore } from '../../stores/settings.store';
import { SyncStore } from '../../stores/sync.store';
import { resolveMeIdentity } from './me-identity';
import { collectDirtyAliasChanges, syncReposFormArray } from './repos-form';
import { GitlabConnectionSectionComponent } from './sections/gitlab-connection/gitlab-connection-section.component';
import { MeSectionComponent } from './sections/me/me-section.component';
import { RefreshSectionComponent } from './sections/refresh/refresh-section.component';
import {
  RepoRow,
  RepositoriesSectionComponent,
} from './sections/repositories/repositories-section.component';
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
    GitlabConnectionSectionComponent,
    MeSectionComponent,
    RefreshSectionComponent,
    RepositoriesSectionComponent,
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
  private readonly syncStore = inject(SyncStore);
  private readonly filtersStore = inject(FiltersStore);
  private readonly mrStore = inject(MergeRequestsStore);
  private readonly columnsStore = inject(ColumnsStore);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly i18n = inject(TranslateService);
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

  protected readonly canTest = computed(() => {
    this.formEvents();
    const { gitlabUrl, gitlabToken } = this.form.controls;
    const hasToken = gitlabToken.value.length > 0 || (this.store.settings()?.tokenConfigured ?? false);
    return gitlabUrl.valid && gitlabToken.valid && hasToken && this.store.test().status !== 'pending';
  });

  /** Identité résolue pour l'aperçu de la section « 01 · Moi » (RG-002-03). */
  protected readonly meIdentity = computed(() => {
    this.formEvents();
    return resolveMeIdentity(this.form.controls.meUsername.value, this.store.test());
  });

  constructor() {
    effect(() => {
      const settings = this.store.settings();
      if (settings && this.form.pristine) {
        resetSettingsForm(this.form, settings);
      }
    });
    // Pré-remplissage du username après un test de connexion réussi, si le
    // champ est encore vide (RG-002-04). Un username déjà saisi n'est jamais
    // écrasé ; le formulaire passe en modifié (non enregistré).
    effect(() => {
      const test = this.store.test();
      if (test.status === 'success' && test.result) {
        const control = this.form.controls.meUsername;
        if (!control.value.trim()) {
          control.setValue(test.result.username);
          control.markAsDirty();
        }
      }
    });
    // Le résultat du test n'est effacé que par un changement d'URL ou de
    // jeton (RG-001-05) — pas par la saisie de l'identité (US-002) ni des
    // alias de repos (US-003), qui partagent désormais le même formulaire.
    merge(
      this.form.controls.gitlabUrl.valueChanges,
      this.form.controls.gitlabToken.valueChanges,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.store.resetTest());
    // Reconstruit inconditionnellement le FormArray des alias à chaque
    // changement de la liste des repos (ajout/suppression immédiats,
    // renommage sauvegardé) — RG-003-07 : une modification d'alias non
    // enregistrée sur une autre ligne est perdue si la liste change entre
    // temps (cas rare, assumé).
    effect(() => {
      const projects = this.projectsStore.projects();
      syncReposFormArray(this.form.controls.repos, projects);
      this.repoRows.set(
        projects.map((project, i) => ({ project, group: this.form.controls.repos.at(i) })),
      );
    });
  }

  ngOnInit(): void {
    void this.store.load();
  }

  /** Contrat du guard d'abandon (RG-001-07). */
  hasUnsavedChanges(): boolean {
    return this.form.dirty;
  }

  protected retry(): void {
    void this.store.load();
  }

  protected testConnection(): void {
    const { gitlabUrl, gitlabToken } = this.form.getRawValue();
    void this.store.testConnection({
      gitlabUrl: gitlabUrl.trim(),
      ...(gitlabToken ? { gitlabToken } : {}),
    });
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
    const aliasChanges = collectDirtyAliasChanges(this.form.controls.repos);
    const renameErrors = await Promise.all(
      aliasChanges.map((change) => this.projectsStore.rename(change.id, { alias: change.alias })),
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
      project: this.filtersStore.project(),
      author: this.filtersStore.author(),
      assigned: this.filtersStore.assigned(),
      approved: this.filtersStore.approved(),
      commented: this.filtersStore.commented(),
      sort: this.mrStore.sort(),
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
