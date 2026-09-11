import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { merge } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslateService } from '../../core/i18n/translate.service';
import { SettingsSectionComponent } from '../../shared/settings-section/settings-section.component';
import { SettingsStore } from '../../stores/settings.store';
import { resolveMeIdentity } from './me-identity';
import { GitlabConnectionSectionComponent } from './sections/gitlab-connection/gitlab-connection-section.component';
import { MeSectionComponent } from './sections/me/me-section.component';
import { buildSettingsForm, resetSettingsForm, toUpdateRequest } from './settings-form';
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
  ],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPageComponent implements OnInit, HasUnsavedChanges {
  protected readonly store = inject(SettingsStore);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly i18n = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly form = buildSettingsForm();
  /** Signal réémis à chaque événement du formulaire (valeur, statut, pristine). */
  private readonly formEvents = toSignal(this.form.events);

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
    // jeton (RG-001-05) — pas par la saisie de l'identité (US-002), qui
    // partage désormais le même formulaire.
    merge(
      this.form.controls.gitlabUrl.valueChanges,
      this.form.controls.gitlabToken.valueChanges,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.store.resetTest());
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
    const errorKey = await this.store.save(toUpdateRequest(this.form));
    if (errorKey) {
      this.toast('settings.saveError');
      return;
    }
    const settings = this.store.settings();
    if (settings) {
      resetSettingsForm(this.form, settings);
    }
    this.toast('settings.saved');
    await this.router.navigateByUrl('/');
  }

  protected cancel(): void {
    void this.router.navigateByUrl('/');
  }

  private toast(key: string): void {
    this.snackBar.open(this.i18n.translate(key), this.i18n.translate('common.ok'), {
      duration: TOAST_DURATION_MS,
      horizontalPosition: 'start',
      panelClass: 'mrb-toast',
    });
  }
}
