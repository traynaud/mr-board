import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Connection, ConnectionType } from '../../models/connection.model';

/** Longueur minimale d'un jeton saisi (RG-019-03, identique au backend). */
export const TOKEN_MIN_LENGTH = 8;

/** URL de connexion par défaut à la création (RG-019-02). */
export const DEFAULT_GITLAB_URL = 'https://gitlab.com';

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
    url: new FormControl(DEFAULT_GITLAB_URL, {
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

/** Pré-remplit le formulaire d'ajout avec les valeurs par défaut (RG-019-02). */
export function resetConnectionFormForAdd(form: ConnectionForm): void {
  form.reset({
    type: 'gitlab',
    name: deriveDefaultConnectionName(DEFAULT_GITLAB_URL),
    url: DEFAULT_GITLAB_URL,
    token: '',
  });
}

/** Pré-remplit le formulaire de modification depuis une connexion existante (RG-019-11). */
export function resetConnectionFormForEdit(form: ConnectionForm, connection: Connection): void {
  form.reset({ type: connection.type, name: connection.name, url: connection.url, token: '' });
}

export interface IdentityFormControls {
  connectionId: FormControl<number>;
  username: FormControl<string>;
}

export type IdentityForm = FormGroup<IdentityFormControls>;

/** Un groupe de formulaire par connexion : mon nom d'utilisateur sur cette connexion (RG-019-08). */
export function buildIdentityGroup(connection: Connection): IdentityForm {
  return new FormGroup<IdentityFormControls>({
    connectionId: new FormControl(connection.id, { nonNullable: true }),
    username: new FormControl(connection.meUsername ?? '', { nonNullable: true }),
  });
}

/**
 * Reconstruit le tableau de formulaires d'identité à partir de la liste des
 * connexions (RG-019-08). Reconstruction inconditionnelle, dans le même
 * ordre que `connections` — la page zippe les deux tableaux par index,
 * comme `syncReposFormArray` le fait pour les repos (RG-003-07).
 */
export function syncIdentitiesFormArray(
  array: FormArray<IdentityForm>,
  connections: Connection[],
): void {
  array.clear();
  for (const connection of connections) {
    array.push(buildIdentityGroup(connection));
  }
  array.markAsPristine();
}
