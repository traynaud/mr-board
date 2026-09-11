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

describe('settings form helpers', () => {
  it('should_build_form_reset_from_settings_and_stay_pristine', () => {
    const form = buildSettingsForm();
    form.controls.gitlabUrl.setValue('x');
    form.markAsDirty();

    resetSettingsForm(form, {
      gitlabUrl: 'https://gitlab.exemple.fr',
      tokenConfigured: true,
      tokenHint: 'wxyz',
    });

    expect(form.getRawValue()).toEqual({ gitlabUrl: 'https://gitlab.exemple.fr', gitlabToken: '' });
    expect(form.pristine).toBe(true);
    expect(form.valid).toBe(true);
  });

  it('should_omit_empty_token_in_request', () => {
    const form = buildSettingsForm();
    form.setValue({ gitlabUrl: ' https://gitlab.com ', gitlabToken: '' });

    expect(toUpdateRequest(form)).toEqual({ gitlabUrl: 'https://gitlab.com' });
  });

  it('should_include_token_when_given', () => {
    const form = buildSettingsForm();
    form.setValue({ gitlabUrl: 'https://gitlab.com', gitlabToken: 'glpat-abcdwxyz' });

    expect(toUpdateRequest(form)).toEqual({
      gitlabUrl: 'https://gitlab.com',
      gitlabToken: 'glpat-abcdwxyz',
    });
  });
});
