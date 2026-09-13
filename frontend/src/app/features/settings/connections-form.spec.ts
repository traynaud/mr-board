import { FormArray, FormControl } from '@angular/forms';
import { Connection } from '../../models/connection.model';
import {
  DEFAULT_GITLAB_URL,
  IdentityForm,
  TOKEN_MIN_LENGTH,
  buildConnectionForm,
  buildIdentityGroup,
  deriveDefaultConnectionName,
  forgeUrlValidator,
  optionalTokenLengthValidator,
  resetConnectionFormForAdd,
  resetConnectionFormForEdit,
  syncIdentitiesFormArray,
} from './connections-form';

function connection(overrides: Partial<Connection> = {}): Connection {
  return {
    id: 1,
    type: 'gitlab',
    name: 'GitLab',
    url: 'https://gitlab.com',
    tokenConfigured: true,
    tokenHint: 'wxyz',
    meUsername: null,
    projectsCount: 0,
    ...overrides,
  };
}

describe('forgeUrlValidator', () => {
  it.each(['https://gitlab.com', 'http://localhost:8929', 'https://gitlab.exemple.fr/'])(
    'should_accept %s',
    (value) => {
      expect(forgeUrlValidator(new FormControl(value))).toBeNull();
    },
  );

  it.each(['gitlab.exemple.fr', 'ftp://gitlab.com', 'https://'])('should_reject %s', (value) => {
    expect(forgeUrlValidator(new FormControl(value))).toEqual({ forgeUrl: true });
  });

  it('should_leave_empty_to_required', () => {
    expect(forgeUrlValidator(new FormControl(''))).toBeNull();
  });
});

describe('optionalTokenLengthValidator', () => {
  it('should_accept_empty_and_long_enough', () => {
    expect(optionalTokenLengthValidator(new FormControl(''))).toBeNull();
    expect(optionalTokenLengthValidator(new FormControl('glpat-abcdwxyz'))).toBeNull();
  });

  it('should_reject_short_token', () => {
    expect(optionalTokenLengthValidator(new FormControl('abc'))).toEqual({
      tokenTooShort: { min: TOKEN_MIN_LENGTH },
    });
  });
});

describe('deriveDefaultConnectionName', () => {
  it.each([
    ['https://gitlab.com', 'gitlab.com'],
    ['https://www.gitlab.com', 'gitlab.com'],
    ['https://gitlab.exemple.fr/', 'gitlab.exemple.fr'],
  ])('should_derive %s as %s', (url, expected) => {
    expect(deriveDefaultConnectionName(url)).toBe(expected);
  });

  it('should_return_an_empty_string_for_an_invalid_url', () => {
    expect(deriveDefaultConnectionName('not a url')).toBe('');
  });
});

describe('buildConnectionForm', () => {
  it('should_require_a_token_when_requireToken_is_true', () => {
    const form = buildConnectionForm(true);

    expect(form.controls.token.hasError('required')).toBe(true);
  });

  it('should_accept_an_empty_token_when_requireToken_is_false', () => {
    const form = buildConnectionForm(false);

    expect(form.controls.token.valid).toBe(true);
  });

  it('should_default_type_to_gitlab_and_url_to_the_default_gitlab_url', () => {
    const form = buildConnectionForm(true);

    expect(form.controls.type.value).toBe('gitlab');
    expect(form.controls.url.value).toBe(DEFAULT_GITLAB_URL);
  });
});

describe('resetConnectionFormForAdd', () => {
  it('should_prefill_the_default_values_and_derived_name', () => {
    const form = buildConnectionForm(true);

    resetConnectionFormForAdd(form);

    expect(form.getRawValue()).toEqual({
      type: 'gitlab',
      name: 'gitlab.com',
      url: DEFAULT_GITLAB_URL,
      token: '',
    });
  });
});

describe('resetConnectionFormForEdit', () => {
  it('should_prefill_from_the_connection_without_the_token', () => {
    const form = buildConnectionForm(false);

    resetConnectionFormForEdit(form, connection({ name: 'gitlab.exemple.fr', url: 'https://gitlab.exemple.fr' }));

    expect(form.getRawValue()).toEqual({
      type: 'gitlab',
      name: 'gitlab.exemple.fr',
      url: 'https://gitlab.exemple.fr',
      token: '',
    });
  });
});

describe('buildIdentityGroup', () => {
  it('should_seed_connectionId_and_username_from_the_connection', () => {
    const group = buildIdentityGroup(connection({ id: 2, meUsername: 'mdupont' }));

    expect(group.getRawValue()).toEqual({ connectionId: 2, username: 'mdupont' });
  });

  it('should_default_username_to_empty_string_when_null', () => {
    const group = buildIdentityGroup(connection({ meUsername: null }));

    expect(group.controls.username.value).toBe('');
  });
});

describe('syncIdentitiesFormArray', () => {
  it('should_rebuild_array_in_the_same_order_as_connections', () => {
    const array = new FormArray<IdentityForm>([]);
    const connections = [connection({ id: 1, meUsername: 'mdupont' }), connection({ id: 2 })];

    syncIdentitiesFormArray(array, connections);

    expect(array.length).toBe(2);
    expect(array.at(0).getRawValue()).toEqual({ connectionId: 1, username: 'mdupont' });
    expect(array.at(1).getRawValue()).toEqual({ connectionId: 2, username: '' });
  });

  it('should_discard_unsaved_edits_on_rebuild', () => {
    const array = new FormArray<IdentityForm>([]);
    const connections = [connection({ id: 1 })];
    syncIdentitiesFormArray(array, connections);
    array.at(0).controls.username.setValue('edited');
    array.at(0).controls.username.markAsDirty();

    syncIdentitiesFormArray(array, connections);

    expect(array.at(0).controls.username.value).toBe('');
    expect(array.dirty).toBe(false);
  });

  it('should_shrink_and_grow_to_match_a_new_list', () => {
    const array = new FormArray<IdentityForm>([]);
    const connections = [connection({ id: 1 }), connection({ id: 2 })];
    syncIdentitiesFormArray(array, connections);

    syncIdentitiesFormArray(array, [connections[0]]);
    expect(array.length).toBe(1);

    syncIdentitiesFormArray(array, [...connections, connection({ id: 3 })]);
    expect(array.length).toBe(3);
  });
});
