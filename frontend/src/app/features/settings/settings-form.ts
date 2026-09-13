import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Language, Settings, ThemePreference, UpdateSettingsRequest } from '../../models/settings.model';
import { IdentityForm } from './connections-form';
import { RepoAliasForm } from './repos-form';

/** Valeurs par défaut des seuils (RG-G03, RG-G04, RG-014-01), reprises par « Réinitialiser » (RG-015-05). */
export const DEFAULT_THRESHOLDS = {
  easyFiles: 5,
  easyLines: 100,
  hardFiles: 20,
  hardLines: 800,
  readyGreenDays: 1,
  readyOrangeDays: 3,
  workdaysOnly: false,
} as const;

/** Labels positionnés par la case « Ignorer les MRs avec le label wip / on-hold » (RG-015-02). */
export const DEFAULT_IGNORED_LABELS = ['wip', 'on-hold'] as const;

export interface SettingsFormControls {
  meEmail: FormControl<string>;
  /** Cadence de synchro planifiée en minutes ; `0` = manuel (RG-013-01). */
  refreshIntervalMin: FormControl<number>;
  /** Met en pause le polling frontend quand l'onglet est masqué (RG-013-05). */
  pauseWhenHidden: FormControl<boolean>;
  /** Seuils de difficulté (RG-G03, RG-014-01). */
  easyFiles: FormControl<number>;
  easyLines: FormControl<number>;
  hardFiles: FormControl<number>;
  hardLines: FormControl<number>;
  /** Seuils de délai Ready en jours (RG-G04, RG-014-01). */
  readyGreenDays: FormControl<number>;
  readyOrangeDays: FormControl<number>;
  /** Ne compter que les jours ouvrés pour le délai Ready (RG-G04, RG-014-01). */
  workdaysOnly: FormControl<boolean>;
  /** Ouvre les MRs dans un nouvel onglet (RG-G11, RG-015-01). */
  openInNewTab: FormControl<boolean>;
  /** Case « Ignorer les MRs avec le label wip / on-hold » (RG-015-02) ; converti vers/depuis `ignoredLabels`. */
  ignoreWip: FormControl<boolean>;
  /** Notification navigateur quand une MR m'est nouvellement assignée (RG-016-01/02). */
  notifyAssigned: FormControl<boolean>;
  /** Badge dans le titre de l'onglet comptant les MRs au niveau Ready rouge (RG-016-04). */
  tabBadge: FormControl<boolean>;
  /** Préférence de thème (RG-018-01/02). */
  theme: FormControl<ThemePreference>;
  /** Surligne mon avatar (auteur, reviewer, affecté) dans le tableau (RG-023-01/02). */
  highlightMe: FormControl<boolean>;
  /** Langue de l'interface (RG-022-01/02). */
  language: FormControl<Language>;
  /** Un groupe par repo existant (id + alias) ; reconstruit par `syncReposFormArray` (RG-003-07). */
  repos: FormArray<RepoAliasForm>;
  /** Un groupe par connexion existante (RG-019-08) ; reconstruit par `syncIdentitiesFormArray`. */
  identities: FormArray<IdentityForm>;
}

export type SettingsForm = FormGroup<SettingsFormControls>;

/** Rejette les valeurs non entières (RG-014-02), ex. `2.5` saisi dans un champ number. */
export const integerValidator: ValidatorFn = (
  control: AbstractControl<number>,
): ValidationErrors | null => {
  const value = control.value;
  return value === null || value === undefined || Number.isInteger(value)
    ? null
    : { integer: true };
};

/**
 * Validateur de groupe (RG-014-01/02) : `hardFiles`/`hardLines` doivent
 * dépasser leur pendant Easy, `readyOrangeDays` doit dépasser
 * `readyGreenDays`. Le groupe parent réévalue ses propres validateurs à
 * chaque changement d'un descendant : modifier `easyFiles` revalide donc
 * `hardFiles` sans action supplémentaire. Pose/efface `{ mustExceed: true }`
 * directement sur le champ en cause, en conservant ses éventuelles autres
 * erreurs (`required`, `min`).
 */
export const thresholdsCrossValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const group = control as SettingsForm;
  applyMustExceed(group.controls.hardFiles, group.controls.easyFiles);
  applyMustExceed(group.controls.hardLines, group.controls.easyLines);
  applyMustExceed(group.controls.readyOrangeDays, group.controls.readyGreenDays);
  return null;
};

function applyMustExceed(target: FormControl<number>, reference: FormControl<number>): void {
  const otherErrors: ValidationErrors = { ...target.errors };
  delete otherErrors['mustExceed'];
  const hasOtherErrors = Object.keys(otherErrors).length > 0;
  if (target.value <= reference.value) {
    target.setErrors({ ...otherErrors, mustExceed: true });
  } else if (hasOtherErrors) {
    target.setErrors(otherErrors);
  } else if (target.errors) {
    target.setErrors(null);
  }
}

/** Construit le formulaire Paramètres. */
export function buildSettingsForm(): SettingsForm {
  return new FormGroup<SettingsFormControls>(
    {
      // Validators.email renvoie null pour une chaîne vide (RG-002-06) : pas
      // besoin de validateur custom pour autoriser un email optionnel.
      meEmail: new FormControl('', {
        nonNullable: true,
        validators: [Validators.email],
      }),
      refreshIntervalMin: new FormControl(5, { nonNullable: true }),
      pauseWhenHidden: new FormControl(true, { nonNullable: true }),
      easyFiles: new FormControl(DEFAULT_THRESHOLDS.easyFiles, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(1), integerValidator],
      }),
      easyLines: new FormControl(DEFAULT_THRESHOLDS.easyLines, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(1), integerValidator],
      }),
      hardFiles: new FormControl(DEFAULT_THRESHOLDS.hardFiles, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(1), integerValidator],
      }),
      hardLines: new FormControl(DEFAULT_THRESHOLDS.hardLines, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(1), integerValidator],
      }),
      readyGreenDays: new FormControl(DEFAULT_THRESHOLDS.readyGreenDays, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(0), integerValidator],
      }),
      readyOrangeDays: new FormControl(DEFAULT_THRESHOLDS.readyOrangeDays, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(0), integerValidator],
      }),
      workdaysOnly: new FormControl(DEFAULT_THRESHOLDS.workdaysOnly, { nonNullable: true }),
      openInNewTab: new FormControl(false, { nonNullable: true }),
      ignoreWip: new FormControl(false, { nonNullable: true }),
      notifyAssigned: new FormControl(false, { nonNullable: true }),
      tabBadge: new FormControl(false, { nonNullable: true }),
      theme: new FormControl<ThemePreference>('system', { nonNullable: true }),
      highlightMe: new FormControl(true, { nonNullable: true }),
      language: new FormControl<Language>('fr', { nonNullable: true }),
      // Peuplés par un effect de la page à partir de ProjectsStore/ConnectionsStore ;
      // jamais touchés par resetSettingsForm (voir ci-dessous).
      repos: new FormArray<RepoAliasForm>([]),
      identities: new FormArray<IdentityForm>([]),
    },
    { validators: [thresholdsCrossValidator] },
  );
}

/**
 * Réinitialise les champs de préférences globales depuis les paramètres
 * chargés (état pristine). Ne touche **jamais** `repos` ni `identities` : ces
 * sous-formulaires ont leur propre cycle de synchronisation
 * (`syncReposFormArray`/`syncIdentitiesFormArray`, pilotés respectivement par
 * `ProjectsStore`/`ConnectionsStore`) — un `form.reset()` global écraserait
 * leurs contrôles avec des valeurs `null` (un `FormArray` n'a pas de valeur
 * de repli sensée ici).
 */
export function resetSettingsForm(form: SettingsForm, settings: Settings): void {
  form.controls.meEmail.reset(settings.meEmail ?? '');
  form.controls.refreshIntervalMin.reset(settings.refreshIntervalMin);
  form.controls.pauseWhenHidden.reset(settings.pauseWhenHidden);
  form.controls.easyFiles.reset(settings.easyFiles);
  form.controls.easyLines.reset(settings.easyLines);
  form.controls.hardFiles.reset(settings.hardFiles);
  form.controls.hardLines.reset(settings.hardLines);
  form.controls.readyGreenDays.reset(settings.readyGreenDays);
  form.controls.readyOrangeDays.reset(settings.readyOrangeDays);
  form.controls.workdaysOnly.reset(settings.workdaysOnly);
  form.controls.openInNewTab.reset(settings.openInNewTab);
  form.controls.ignoreWip.reset(settings.ignoredLabels.length > 0);
  form.controls.notifyAssigned.reset(settings.notifyAssigned);
  form.controls.tabBadge.reset(settings.tabBadge);
  form.controls.theme.reset(settings.theme);
  form.controls.highlightMe.reset(settings.highlightMe);
  form.controls.language.reset(settings.language);
}

/**
 * Remet le formulaire aux valeurs par défaut de toutes les sections
 * (RG-015-05), sans rien enregistrer. Ne touche **jamais** `repos` ni
 * `identities` (même raison que `resetSettingsForm`). Marque les champs
 * concernés comme modifiés, pour que « Enregistrer » se réactive.
 */
export function resetSettingsFormToDefaults(form: SettingsForm): void {
  const { controls } = form;
  controls.meEmail.setValue('');
  controls.refreshIntervalMin.setValue(5);
  controls.pauseWhenHidden.setValue(true);
  controls.easyFiles.setValue(DEFAULT_THRESHOLDS.easyFiles);
  controls.easyLines.setValue(DEFAULT_THRESHOLDS.easyLines);
  controls.hardFiles.setValue(DEFAULT_THRESHOLDS.hardFiles);
  controls.hardLines.setValue(DEFAULT_THRESHOLDS.hardLines);
  controls.readyGreenDays.setValue(DEFAULT_THRESHOLDS.readyGreenDays);
  controls.readyOrangeDays.setValue(DEFAULT_THRESHOLDS.readyOrangeDays);
  controls.workdaysOnly.setValue(DEFAULT_THRESHOLDS.workdaysOnly);
  controls.openInNewTab.setValue(false);
  controls.ignoreWip.setValue(false);
  controls.notifyAssigned.setValue(false);
  controls.tabBadge.setValue(false);
  controls.theme.setValue('system');
  controls.highlightMe.setValue(true);
  controls.language.setValue('fr');
  for (const name of Object.keys(controls) as (keyof SettingsFormControls)[]) {
    if (name !== 'repos' && name !== 'identities') {
      controls[name].markAsDirty();
    }
  }
}

/**
 * Convertit le formulaire en corps de `PUT /settings`. `meEmail` est
 * **toujours** envoyé, y compris vide, pour permettre son effacement
 * (RG-002-02). `identities` porte une entrée par connexion existante — les
 * envoyer toutes est sans effet indésirable (RG-019-08) ; `repos` n'en fait
 * pas partie (suit son propre appel `PUT /projects/:id`).
 */
export function toUpdateRequest(form: SettingsForm): UpdateSettingsRequest {
  const {
    meEmail,
    refreshIntervalMin,
    pauseWhenHidden,
    easyFiles,
    easyLines,
    hardFiles,
    hardLines,
    readyGreenDays,
    readyOrangeDays,
    workdaysOnly,
    openInNewTab,
    ignoreWip,
    notifyAssigned,
    tabBadge,
    theme,
    highlightMe,
    language,
    identities,
  } = form.getRawValue();
  return {
    meEmail: meEmail.trim(),
    refreshIntervalMin,
    pauseWhenHidden,
    easyFiles,
    easyLines,
    hardFiles,
    hardLines,
    readyGreenDays,
    readyOrangeDays,
    workdaysOnly,
    openInNewTab,
    ignoredLabels: ignoreWip ? [...DEFAULT_IGNORED_LABELS] : [],
    notifyAssigned,
    tabBadge,
    theme,
    highlightMe,
    language,
    identities: identities.map(({ connectionId, username }) => ({
      connectionId,
      username: username.trim(),
    })),
  };
}
