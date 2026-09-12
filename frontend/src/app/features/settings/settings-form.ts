import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Settings, UpdateSettingsRequest } from '../../models/settings.model';
import { RepoAliasForm } from './repos-form';

/** Longueur minimale d'un jeton saisi (RG-001-02, identique au backend). */
export const TOKEN_MIN_LENGTH = 8;

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

/** URL GitLab par défaut (miroir de `DEFAULT_GITLAB_URL` côté backend), reprise par « Réinitialiser ». */
export const DEFAULT_GITLAB_URL = 'https://gitlab.com';

/** Labels positionnés par la case « Ignorer les MRs avec le label wip / on-hold » (RG-015-02). */
export const DEFAULT_IGNORED_LABELS = ['wip', 'on-hold'] as const;

export interface SettingsFormControls {
  gitlabUrl: FormControl<string>;
  gitlabToken: FormControl<string>;
  meUsername: FormControl<string>;
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
  /** Un groupe par repo existant (id + alias) ; reconstruit par `syncReposFormArray` (RG-003-07). */
  repos: FormArray<RepoAliasForm>;
}

export type SettingsForm = FormGroup<SettingsFormControls>;

/**
 * Valide une URL d'instance GitLab : schéma http(s) et hôte présents
 * (même règle que `normalizeGitlabUrl` côté backend, RG-001-01).
 */
export const gitlabUrlValidator: ValidatorFn = (
  control: AbstractControl<string>,
): ValidationErrors | null => {
  const value = control.value?.trim() ?? '';
  if (!value) {
    return null;
  }
  if (!/^https?:\/\//i.test(value)) {
    return { gitlabUrl: true };
  }
  try {
    return new URL(value).hostname ? null : { gitlabUrl: true };
  } catch {
    return { gitlabUrl: true };
  }
};

/** Un jeton vide est accepté (conserve l'existant) ; sinon longueur minimale. */
export const tokenLengthValidator: ValidatorFn = (
  control: AbstractControl<string>,
): ValidationErrors | null => {
  const value = control.value ?? '';
  return value.length === 0 || value.length >= TOKEN_MIN_LENGTH
    ? null
    : { tokenTooShort: { min: TOKEN_MIN_LENGTH } };
};

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

/** Construit le formulaire Paramètres. Le jeton n'est jamais pré-rempli. */
export function buildSettingsForm(): SettingsForm {
  return new FormGroup<SettingsFormControls>(
    {
      gitlabUrl: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, gitlabUrlValidator],
      }),
      gitlabToken: new FormControl('', {
        nonNullable: true,
        validators: [tokenLengthValidator],
      }),
      meUsername: new FormControl('', { nonNullable: true }),
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
      // Peuplé par un effect de la page à partir de ProjectsStore ; jamais
      // touché par resetSettingsForm (voir ci-dessous).
      repos: new FormArray<RepoAliasForm>([]),
    },
    { validators: [thresholdsCrossValidator] },
  );
}

/**
 * Réinitialise les champs URL/jeton/identité depuis les paramètres chargés
 * (état pristine). Ne touche **jamais** `repos` : ce sous-formulaire a son
 * propre cycle de synchronisation (`syncReposFormArray`, piloté par
 * `ProjectsStore`) — un `form.reset()` global écraserait ses contrôles avec
 * des valeurs `null` (FormArray n'a pas de valeur de repli sensée ici).
 */
export function resetSettingsForm(form: SettingsForm, settings: Settings): void {
  form.controls.gitlabUrl.reset(settings.gitlabUrl);
  form.controls.gitlabToken.reset('');
  form.controls.meUsername.reset(settings.meUsername ?? '');
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
}

/**
 * Remet le formulaire aux valeurs par défaut de toutes les sections
 * (RG-015-05), sans rien enregistrer. Ne touche **jamais** `gitlabToken`
 * (le jeton n'est jamais effacé par cette action) ni `repos` (même raison
 * que `resetSettingsForm`). Marque les champs concernés comme modifiés,
 * pour que « Enregistrer » se réactive.
 */
export function resetSettingsFormToDefaults(form: SettingsForm): void {
  const { controls } = form;
  controls.gitlabUrl.setValue(DEFAULT_GITLAB_URL);
  controls.meUsername.setValue('');
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
  for (const name of Object.keys(controls) as (keyof SettingsFormControls)[]) {
    if (name !== 'gitlabToken' && name !== 'repos') {
      controls[name].markAsDirty();
    }
  }
}

/**
 * Convertit le formulaire en corps de `PUT /settings`. `gitlabToken` est omis
 * si vide (jeton inchangé) ; `meUsername`/`meEmail` sont **toujours** envoyés,
 * y compris vides, pour permettre leur effacement (RG-002-02). `repos` n'en
 * fait pas partie : les renommages d'alias suivent leur propre appel
 * `PUT /projects/:id` (voir `collectDirtyAliasChanges`).
 */
export function toUpdateRequest(form: SettingsForm): UpdateSettingsRequest {
  const {
    gitlabUrl,
    gitlabToken,
    meUsername,
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
  } = form.getRawValue();
  return {
    gitlabUrl: gitlabUrl.trim(),
    ...(gitlabToken ? { gitlabToken } : {}),
    meUsername: meUsername.trim(),
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
  };
}
