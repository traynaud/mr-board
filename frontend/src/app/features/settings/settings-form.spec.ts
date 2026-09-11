import { FormControl } from '@angular/forms';
import {
  buildSettingsForm,
  gitlabUrlValidator,
  resetSettingsForm,
  toUpdateRequest,
  tokenLengthValidator,
} from './settings-form';

describe('gitlabUrlValidator', () => {
  it.each(['https://gitlab.com', 'http://localhost:8929', 'https://gitlab.exemple.fr/'])(
    'should_accept %s',
    (value) => {
      expect(gitlabUrlValidator(new FormControl(value))).toBeNull();
    },
  );

  it.each(['gitlab.exemple.fr', 'ftp://gitlab.com', 'https://'])('should_reject %s', (value) => {
    expect(gitlabUrlValidator(new FormControl(value))).toEqual({ gitlabUrl: true });
  });

  it('should_leave_empty_to_required', () => {
    expect(gitlabUrlValidator(new FormControl(''))).toBeNull();
  });
});

describe('tokenLengthValidator', () => {
  it('should_accept_empty_and_long_enough', () => {
    expect(tokenLengthValidator(new FormControl(''))).toBeNull();
    expect(tokenLengthValidator(new FormControl('glpat-abcdwxyz'))).toBeNull();
  });

  it('should_reject_short_token', () => {
    expect(tokenLengthValidator(new FormControl('abc'))).toEqual({
      tokenTooShort: { min: 8 },
    });
  });
});

describe('meEmail validator (Validators.email)', () => {
  it('should_build_form_with_email_control_accepting_empty_value', () => {
    const form = buildSettingsForm();

    expect(form.controls.meEmail.valid).toBe(true);

    form.controls.meEmail.setValue('marie@');
    expect(form.controls.meEmail.hasError('email')).toBe(true);

    form.controls.meEmail.setValue('marie@exemple.fr');
    expect(form.controls.meEmail.valid).toBe(true);
  });
});

describe('settings form helpers', () => {
  const settings = {
    gitlabUrl: 'https://gitlab.exemple.fr',
    tokenConfigured: true,
    tokenHint: 'wxyz',
    meUsername: 'mdupont',
    meEmail: 'marie@exemple.fr',
  };

  it('should_build_form_reset_from_settings_and_stay_pristine', () => {
    const form = buildSettingsForm();
    form.controls.gitlabUrl.setValue('x');
    form.markAsDirty();

    resetSettingsForm(form, settings);

    expect(form.getRawValue()).toEqual({
      gitlabUrl: 'https://gitlab.exemple.fr',
      gitlabToken: '',
      meUsername: 'mdupont',
      meEmail: 'marie@exemple.fr',
    });
    expect(form.pristine).toBe(true);
    expect(form.valid).toBe(true);
  });

  it('should_reset_identity_fields_to_empty_string_when_null', () => {
    const form = buildSettingsForm();

    resetSettingsForm(form, { ...settings, meUsername: null, meEmail: null });

    expect(form.controls.meUsername.value).toBe('');
    expect(form.controls.meEmail.value).toBe('');
  });

  it('should_omit_empty_token_but_always_include_identity_fields', () => {
    const form = buildSettingsForm();
    form.setValue({
      gitlabUrl: ' https://gitlab.com ',
      gitlabToken: '',
      meUsername: ' mdupont ',
      meEmail: '',
    });

    expect(toUpdateRequest(form)).toEqual({
      gitlabUrl: 'https://gitlab.com',
      meUsername: 'mdupont',
      meEmail: '',
    });
  });

  it('should_include_token_when_given', () => {
    const form = buildSettingsForm();
    form.setValue({
      gitlabUrl: 'https://gitlab.com',
      gitlabToken: 'glpat-abcdwxyz',
      meUsername: '',
      meEmail: '',
    });

    expect(toUpdateRequest(form)).toEqual({
      gitlabUrl: 'https://gitlab.com',
      gitlabToken: 'glpat-abcdwxyz',
      meUsername: '',
      meEmail: '',
    });
  });
});
