import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { Project } from '../../models/project.model';
import {
  RepoAliasForm,
  aliasFormatValidator,
  buildRepoAliasGroup,
  collectDirtyAliasChanges,
  optionalAliasFormatValidator,
  syncReposFormArray,
} from './repos-form';

const projects: Project[] = [
  { id: 1, pathWithNamespace: 'equipe/backend-api', alias: 'api', gitlabProjectId: 42 },
  { id: 2, pathWithNamespace: 'equipe/front-web', alias: 'web', gitlabProjectId: 7 },
];

describe('aliasFormatValidator', () => {
  it.each(['api', 'a', 'a'.repeat(20), 'api-web', 'api_web', 'api.web', 'Api2'])(
    'should_accept %s',
    (value) => {
      expect(aliasFormatValidator(new FormControl(value))).toBeNull();
    },
  );

  it.each(['api,web', 'a'.repeat(21), '', 'api web'])('should_reject %s', (value) => {
    expect(aliasFormatValidator(new FormControl(value))).toEqual({ aliasFormat: true });
  });
});

describe('optionalAliasFormatValidator', () => {
  it('should_accept_empty_value', () => {
    expect(optionalAliasFormatValidator(new FormControl(''))).toBeNull();
  });

  it.each(['api', 'api-web'])('should_accept %s', (value) => {
    expect(optionalAliasFormatValidator(new FormControl(value))).toBeNull();
  });

  it.each(['api,web', 'a'.repeat(21)])('should_reject %s', (value) => {
    expect(optionalAliasFormatValidator(new FormControl(value))).toEqual({ aliasFormat: true });
  });
});

describe('buildRepoAliasGroup', () => {
  it('should_seed_id_and_alias_from_project', () => {
    const group = buildRepoAliasGroup(projects[0]);

    expect(group.getRawValue()).toEqual({ id: 1, alias: 'api' });
    expect(group.pristine).toBe(true);
  });
});

describe('syncReposFormArray', () => {
  it('should_rebuild_array_in_the_same_order_as_projects', () => {
    const array = new FormArray<RepoAliasForm>([]);

    syncReposFormArray(array, projects);

    expect(array.length).toBe(2);
    expect(array.at(0).getRawValue()).toEqual({ id: 1, alias: 'api' });
    expect(array.at(1).getRawValue()).toEqual({ id: 2, alias: 'web' });
  });

  it('should_discard_unsaved_edits_on_rebuild', () => {
    const array = new FormArray<RepoAliasForm>([]);
    syncReposFormArray(array, projects);
    array.at(0).controls.alias.setValue('edited');
    array.at(0).controls.alias.markAsDirty();
    expect(array.at(0).controls.alias.dirty).toBe(true);

    syncReposFormArray(array, projects);

    expect(array.at(0).controls.alias.value).toBe('api');
    expect(array.at(0).controls.alias.dirty).toBe(false);
  });

  it('should_reset_the_array_own_dirty_flag_after_rebuild', () => {
    // Régression : clear()+push() rendent les CONTRÔLES enfants pristines,
    // mais le flag `dirty` propre du FormArray ne se réévalue pas tout seul.
    const array = new FormArray<RepoAliasForm>([]);
    syncReposFormArray(array, projects);
    array.at(0).controls.alias.setValue('edited');
    array.at(0).controls.alias.markAsDirty();
    expect(array.dirty).toBe(true);

    syncReposFormArray(array, projects);

    expect(array.dirty).toBe(false);
  });

  it('should_reset_the_parent_form_pristine_state_after_rebuild', () => {
    const parent = new FormGroup({ repos: new FormArray<RepoAliasForm>([]) });
    syncReposFormArray(parent.controls.repos, projects);
    parent.controls.repos.at(0).controls.alias.setValue('edited');
    parent.controls.repos.at(0).controls.alias.markAsDirty();
    expect(parent.dirty).toBe(true);

    syncReposFormArray(parent.controls.repos, projects);

    expect(parent.dirty).toBe(false);
  });

  it('should_shrink_and_grow_to_match_a_new_list', () => {
    const array = new FormArray<RepoAliasForm>([]);
    syncReposFormArray(array, projects);

    syncReposFormArray(array, [projects[0]]);
    expect(array.length).toBe(1);

    syncReposFormArray(array, [...projects, { id: 3, pathWithNamespace: 'x/y', alias: 'xy', gitlabProjectId: 9 }]);
    expect(array.length).toBe(3);
  });
});

describe('collectDirtyAliasChanges', () => {
  it('should_return_only_dirty_and_valid_aliases_trimmed', () => {
    const array = new FormArray<RepoAliasForm>([]);
    syncReposFormArray(array, projects);
    array.at(0).controls.alias.setValue('  back  ');
    array.at(0).controls.alias.markAsDirty();
    array.at(1).controls.alias.setValue('api,web'); // dirty but invalid format
    array.at(1).controls.alias.markAsDirty();

    expect(collectDirtyAliasChanges(array)).toEqual([{ id: 1, alias: 'back' }]);
  });

  it('should_return_empty_array_when_nothing_changed', () => {
    const array = new FormArray<RepoAliasForm>([]);
    syncReposFormArray(array, projects);

    expect(collectDirtyAliasChanges(array)).toEqual([]);
  });
});
