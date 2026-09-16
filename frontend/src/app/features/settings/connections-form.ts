import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Connection, ConnectionType } from '../../models/connection.model';

/** Longueur minimale d'un jeton saisi (RG-019-03, identique au backend). */
export const TOKEN_MIN_LENGTH = 8;

/** URL de connexion par défaut à la création, par type (RG-019-02, RG-020-01). */
export const DEFAULT_URLS: Record<ConnectionType, string> = {
  gitlab: 'https://gitlab.com',
  github: 'https://github.com',
};

/**
 * Valide une URL d'instance de forge : schéma http(s) et hôte présents
 * (même règle que `normalizeGitlabUrl` côté backend, RG-001-01).
 */
export const forgeUrlValidator: ValidatorFn = (
  control: AbstractControl<string>,
): ValidationErrors | null => {
  const value = control.value?.trim() ?? '';
  if (!value) {
    return null;
  }
  if (!/^https?:\/\//i.test(value)) {
    return { forgeUrl: true };
  }
  try {
    return new URL(value).hostname ? null : { forgeUrl: true };
  } catch {
    return { forgeUrl: true };
  }
};

/** Un jeton vide est accepté (conserve l'existant, RG-019-03) ; sinon longueur minimale. */
export const optionalTokenLengthValidator: ValidatorFn = (
  control: AbstractControl<string>,
): ValidationErrors | null => {
  const value = control.value ?? '';
  return value.length === 0 || value.length >= TOKEN_MIN_LENGTH
    ? null
    : { tokenTooShort: { min: TOKEN_MIN_LENGTH } };
};

/** Dérive le nom par défaut d'une connexion depuis son URL : l'hôte sans `www.` (RG-019-02). */
export function deriveDefaultConnectionName(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

export interface ConnectionFormControls {
  type: FormControl<ConnectionType>;
  name: FormControl<string>;
  url: FormControl<string>;
  /** Requis à la création (RG-019-03) ; ce contrôle porte `Validators.required` en plus au moment de l'ouverture du formulaire d'ajout. */
  token: FormControl<string>;
}

export type ConnectionForm = FormGroup<ConnectionFormControls>;

/**
 * Construit le formulaire d'ajout/modification d'une connexion (RG-019-11).
 * @param requireToken `true` pour l'ajout (jeton obligatoire, RG-019-03), `false` pour la modification.
 */
export function buildConnectionForm(requireToken: boolean): ConnectionForm {
  return new FormGroup<ConnectionFormControls>({
    type: new FormControl<ConnectionType>('gitlab', { nonNullable: true }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    url: new FormControl(DEFAULT_URLS.gitlab, {
      nonNullable: true,
      validators: [Validators.required, forgeUrlValidator],
    }),
    token: new FormControl('', {
      nonNullable: true,
      validators: requireToken
        ? [Validators.required, Validators.minLength(TOKEN_MIN_LENGTH)]
        : [optionalTokenLengthValidator],
    }),
  });
}

/** Pré-remplit le formulaire d'ajout avec les valeurs par défaut du type choisi (RG-019-02, RG-020-01). */
export function resetConnectionFormForAdd(
  form: ConnectionForm,
  type: ConnectionType = 'gitlab',
): void {
  const url = DEFAULT_URLS[type];
  form.reset({
    type,
    name: deriveDefaultConnectionName(url),
    url,
    token: '',
  });
}

/**
 * Ré-applique les valeurs par défaut du type sélectionné (nom, URL) quand
 * l'utilisateur change de type dans un formulaire d'ajout déjà ouvert
 * (RG-020-01) — le type n'est en revanche jamais modifiable après création
 * (RG-019-11), donc jamais appelée en modification.
 */
export function applyConnectionTypeDefaults(form: ConnectionForm, type: ConnectionType): void {
  const url = DEFAULT_URLS[type];
  form.controls.name.setValue(deriveDefaultConnectionName(url));
  form.controls.url.setValue(url);
}

/** Pré-remplit le formulaire de modification depuis une connexion existante (RG-019-11). */
export function resetConnectionFormForEdit(form: ConnectionForm, connection: Connection): void {
  form.reset({ type: connection.type, name: connection.name, url: connection.url, token: '' });
}
