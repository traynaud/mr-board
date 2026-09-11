import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Settings, UpdateSettingsRequest } from '../../models/settings.model';

/** Longueur minimale d'un jeton saisi (RG-001-02, identique au backend). */
export const TOKEN_MIN_LENGTH = 8;

export interface SettingsFormControls {
  gitlabUrl: FormControl<string>;
  gitlabToken: FormControl<string>;
  meUsername: FormControl<string>;
  meEmail: FormControl<string>;
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

/** Construit le formulaire Paramètres. Le jeton n'est jamais pré-rempli. */
export function buildSettingsForm(): SettingsForm {
  return new FormGroup<SettingsFormControls>({
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
  });
}

/** Réinitialise le formulaire depuis les paramètres chargés (état pristine). */
export function resetSettingsForm(form: SettingsForm, settings: Settings): void {
  form.reset({
    gitlabUrl: settings.gitlabUrl,
    gitlabToken: '',
    meUsername: settings.meUsername ?? '',
    meEmail: settings.meEmail ?? '',
  });
}

/**
 * Convertit le formulaire en corps de `PUT /settings`. `gitlabToken` est omis
 * si vide (jeton inchangé) ; `meUsername`/`meEmail` sont **toujours** envoyés,
 * y compris vides, pour permettre leur effacement (RG-002-02).
 */
export function toUpdateRequest(form: SettingsForm): UpdateSettingsRequest {
  const { gitlabUrl, gitlabToken, meUsername, meEmail } = form.getRawValue();
  return {
    gitlabUrl: gitlabUrl.trim(),
    ...(gitlabToken ? { gitlabToken } : {}),
    meUsername: meUsername.trim(),
    meEmail: meEmail.trim(),
  };
}
