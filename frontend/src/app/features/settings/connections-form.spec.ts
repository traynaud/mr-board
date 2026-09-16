import { FormControl } from '@angular/forms';
import { Connection } from '../../models/connection.model';
import {
  DEFAULT_URLS,
  TOKEN_MIN_LENGTH,
  applyConnectionTypeDefaults,
  buildConnectionForm,
  deriveDefaultConnectionName,
  forgeUrlValidator,
  optionalTokenLengthValidator,
  resetConnectionFormForAdd,
  resetConnectionFormForEdit,
} from './connections-form';

function connection(overrides: Partial<Connection> = {}): Connection {
  return {
    id: 1,
    type: 'gitlab',
    name: 'GitLab',
    url: 'https://gitlab.com',
    tokenConfigured: true,
    tokenHint: 'wxyz',
    identity: null,
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
    expect(form.controls.url.value).toBe(DEFAULT_URLS.gitlab);
  });
});

describe('resetConnectionFormForAdd', () => {
  it('should_prefill_the_gitlab_default_values_and_derived_name', () => {
    const form = buildConnectionForm(true);

    resetConnectionFormForAdd(form);

    expect(form.getRawValue()).toEqual({
      type: 'gitlab',
      name: 'gitlab.com',
      url: DEFAULT_URLS.gitlab,
      token: '',
    });
  });

  it('should_prefill_the_github_default_values_and_derived_name', () => {
    const form = buildConnectionForm(true);

    resetConnectionFormForAdd(form, 'github');

    expect(form.getRawValue()).toEqual({
      type: 'github',
      name: 'github.com',
      url: DEFAULT_URLS.github,
      token: '',
    });
  });
});

describe('applyConnectionTypeDefaults', () => {
  it('should_replace_the_name_and_url_with_the_new_types_defaults', () => {
    const form = buildConnectionForm(true);
    resetConnectionFormForAdd(form, 'gitlab');

    applyConnectionTypeDefaults(form, 'github');

    expect(form.controls.name.value).toBe('github.com');
    expect(form.controls.url.value).toBe(DEFAULT_URLS.github);
  });

  it('should_overwrite_a_manually_edited_name_and_url', () => {
    const form = buildConnectionForm(true);
    resetConnectionFormForAdd(form, 'gitlab');
    form.controls.name.setValue('mon-gitlab');
    form.controls.url.setValue('https://gitlab.exemple.fr');

    applyConnectionTypeDefaults(form, 'github');

    expect(form.controls.name.value).toBe('github.com');
    expect(form.controls.url.value).toBe(DEFAULT_URLS.github);
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
