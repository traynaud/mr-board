import { FormArray, FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { Project } from '../../models/project.model';

/** Alias charset/length (RG-003-04), identique à la règle backend. */
export const ALIAS_PATTERN = /^[A-Za-z0-9._-]{1,20}$/;

// Le motif est testé sur la valeur trimée : les espaces de bordure sont
// silencieusement ignorés à l'enregistrement (comme le backend, RG-003-01/02
// style), le champ ne doit donc pas les traiter comme une erreur de format.
export const aliasFormatValidator: ValidatorFn = (control) => {
  const value = (control.value as string).trim();
  return ALIAS_PATTERN.test(value) ? null : { aliasFormat: true };
};

/** Comme `aliasFormatValidator`, mais une valeur vide est acceptée (RG-003-05 : alias optionnel à l'ajout). */
export const optionalAliasFormatValidator: ValidatorFn = (control) => {
  const value = (control.value as string).trim();
  return value.length === 0 || ALIAS_PATTERN.test(value) ? null : { aliasFormat: true };
};

export interface RepoAliasFormGroup {
  id: FormControl<number>;
  alias: FormControl<string>;
}

export type RepoAliasForm = FormGroup<RepoAliasFormGroup>;

/** Un groupe de formulaire par repo existant : id (lecture seule) + alias (éditable). */
export function buildRepoAliasGroup(project: Project): RepoAliasForm {
  return new FormGroup<RepoAliasFormGroup>({
    id: new FormControl(project.id, { nonNullable: true }),
    alias: new FormControl(project.alias, {
      nonNullable: true,
      validators: [Validators.required, aliasFormatValidator],
    }),
  });
}

/**
 * Reconstruit le tableau de formulaires d'alias à partir de la liste des
 * repos (RG-003-07). Reconstruction inconditionnelle, dans le même ordre que
 * `projects` — la page zippe les deux tableaux par index, pas par id.
 */
export function syncReposFormArray(array: FormArray<RepoAliasForm>, projects: Project[]): void {
  array.clear();
  for (const project of projects) {
    array.push(buildRepoAliasGroup(project));
  }
  // clear()/push() remplacent les contrôles enfants (frais, pristines), mais
  // le flag dirty propre du FormArray est une simple propriété, pas un
  // agrégat recalculé à la volée : il reste à `true` depuis une modification
  // antérieure tant qu'on ne le réinitialise pas explicitement ici. Réévalue
  // aussi la pristineté du formulaire parent (RG-003-07).
  array.markAsPristine();
}

/** Alias modifiés (dirty et valides) à envoyer au serveur lors de l'enregistrement global. */
export function collectDirtyAliasChanges(
  array: FormArray<RepoAliasForm>,
): { id: number; alias: string }[] {
  return array.controls
    .filter((group) => group.controls.alias.dirty && group.controls.alias.valid)
    .map((group) => ({
      id: group.controls.id.value,
      alias: group.controls.alias.value.trim(),
    }));
}
