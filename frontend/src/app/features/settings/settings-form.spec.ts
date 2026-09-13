import { FormControl } from '@angular/forms';
import { buildRepoAliasGroup } from './repos-form';
import {
  DEFAULT_GITLAB_URL,
  DEFAULT_IGNORED_LABELS,
  DEFAULT_THRESHOLDS,
  buildSettingsForm,
  gitlabUrlValidator,
  integerValidator,
  resetSettingsForm,
  resetSettingsFormToDefaults,
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

describe('integerValidator', () => {
  it('should_accept_integers', () => {
    expect(integerValidator(new FormControl(5))).toBeNull();
    expect(integerValidator(new FormControl(0))).toBeNull();
  });

  it('should_reject_decimals', () => {
    expect(integerValidator(new FormControl(2.5))).toEqual({ integer: true });
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
    refreshIntervalMin: 15,
    pauseWhenHidden: false,
    easyFiles: 10,
    easyLines: 200,
    hardFiles: 30,
    hardLines: 900,
    readyGreenDays: 2,
    readyOrangeDays: 5,
    workdaysOnly: true,
    openInNewTab: true,
    ignoredLabels: ['wip', 'on-hold'],
    notifyAssigned: true,
    tabBadge: true,
    theme: 'dark' as const,
    highlightMe: false,
    language: 'en' as const,
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
      refreshIntervalMin: 15,
      pauseWhenHidden: false,
      easyFiles: 10,
      easyLines: 200,
      hardFiles: 30,
      hardLines: 900,
      readyGreenDays: 2,
      readyOrangeDays: 5,
      workdaysOnly: true,
      openInNewTab: true,
      ignoreWip: true,
      notifyAssigned: true,
      tabBadge: true,
      theme: 'dark',
      highlightMe: false,
      language: 'en',
      repos: [],
    });
    expect(form.pristine).toBe(true);
    expect(form.valid).toBe(true);
  });

  it('should_reset_ignore_wip_to_false_when_ignored_labels_is_empty', () => {
    const form = buildSettingsForm();

    resetSettingsForm(form, { ...settings, ignoredLabels: [] });

    expect(form.controls.ignoreWip.value).toBe(false);
  });

  it('should_reset_identity_fields_to_empty_string_when_null', () => {
    const form = buildSettingsForm();

    resetSettingsForm(form, { ...settings, meUsername: null, meEmail: null });

    expect(form.controls.meUsername.value).toBe('');
    expect(form.controls.meEmail.value).toBe('');
  });

  it('should_omit_empty_token_but_always_include_identity_fields', () => {
    const form = buildSettingsForm();
    form.patchValue({
      gitlabUrl: ' https://gitlab.com ',
      gitlabToken: '',
      meUsername: ' mdupont ',
      meEmail: '',
    });

    expect(toUpdateRequest(form)).toEqual({
      gitlabUrl: 'https://gitlab.com',
      meUsername: 'mdupont',
      meEmail: '',
      refreshIntervalMin: 5,
      pauseWhenHidden: true,
      ...DEFAULT_THRESHOLDS,
      openInNewTab: false,
      ignoredLabels: [],
      notifyAssigned: false,
      tabBadge: false,
      theme: 'system',
      highlightMe: true,
      language: 'fr',
    });
  });

  it('should_include_token_when_given', () => {
    const form = buildSettingsForm();
    form.patchValue({
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
      refreshIntervalMin: 5,
      pauseWhenHidden: true,
      ...DEFAULT_THRESHOLDS,
      openInNewTab: false,
      ignoredLabels: [],
      notifyAssigned: false,
      tabBadge: false,
      theme: 'system',
      highlightMe: true,
      language: 'fr',
    });
  });

  it('should_include_the_refresh_settings_in_the_update_request', () => {
    const form = buildSettingsForm();
    form.patchValue({
      gitlabUrl: 'https://gitlab.com',
      refreshIntervalMin: 30,
      pauseWhenHidden: false,
    });

    expect(toUpdateRequest(form)).toEqual(
      expect.objectContaining({ refreshIntervalMin: 30, pauseWhenHidden: false }),
    );
  });

  it('should_reset_the_refresh_settings_from_settings', () => {
    const form = buildSettingsForm();

    resetSettingsForm(form, settings);

    expect(form.controls.refreshIntervalMin.value).toBe(15);
    expect(form.controls.pauseWhenHidden.value).toBe(false);
  });

  it('should_not_include_repos_in_the_update_request', () => {
    const form = buildSettingsForm();

    expect(toUpdateRequest(form)).not.toHaveProperty('repos');
  });

  it('should_never_touch_the_repos_form_array', () => {
    const form = buildSettingsForm();
    form.controls.repos.push(
      buildRepoAliasGroup({
        id: 1,
        pathWithNamespace: 'equipe/backend-api',
        alias: 'api',
        gitlabProjectId: 42,
      }),
    );

    resetSettingsForm(form, settings);

    expect(form.controls.repos.length).toBe(1);
    expect(form.controls.repos.at(0).getRawValue()).toEqual({ id: 1, alias: 'api' });
  });

  it('should_send_the_default_ignored_labels_when_ignore_wip_is_checked', () => {
    const form = buildSettingsForm();
    form.patchValue({ gitlabUrl: 'https://gitlab.com', ignoreWip: true, openInNewTab: true });

    expect(toUpdateRequest(form)).toEqual(
      expect.objectContaining({
        openInNewTab: true,
        ignoredLabels: [...DEFAULT_IGNORED_LABELS],
      }),
    );
  });

  it('should_send_an_empty_ignored_labels_array_when_ignore_wip_is_unchecked', () => {
    const form = buildSettingsForm();
    form.patchValue({ gitlabUrl: 'https://gitlab.com', ignoreWip: false });

    expect(toUpdateRequest(form)).toEqual(expect.objectContaining({ ignoredLabels: [] }));
  });

  it('should_include_the_notification_settings_in_the_update_request', () => {
    const form = buildSettingsForm();
    form.patchValue({
      gitlabUrl: 'https://gitlab.com',
      notifyAssigned: true,
      tabBadge: true,
    });

    expect(toUpdateRequest(form)).toEqual(
      expect.objectContaining({ notifyAssigned: true, tabBadge: true }),
    );
  });

  it('should_reset_the_notification_settings_from_settings', () => {
    const form = buildSettingsForm();

    resetSettingsForm(form, settings);

    expect(form.controls.notifyAssigned.value).toBe(true);
    expect(form.controls.tabBadge.value).toBe(true);
  });

  it('should_include_the_theme_in_the_update_request', () => {
    const form = buildSettingsForm();
    form.patchValue({ gitlabUrl: 'https://gitlab.com', theme: 'dark' });

    expect(toUpdateRequest(form)).toEqual(expect.objectContaining({ theme: 'dark' }));
  });

  it('should_reset_the_theme_from_settings', () => {
    const form = buildSettingsForm();

    resetSettingsForm(form, settings);

    expect(form.controls.theme.value).toBe('dark');
  });

  it('should_include_highlight_me_in_the_update_request', () => {
    const form = buildSettingsForm();
    form.patchValue({ gitlabUrl: 'https://gitlab.com', highlightMe: false });

    expect(toUpdateRequest(form)).toEqual(expect.objectContaining({ highlightMe: false }));
  });

  it('should_reset_highlight_me_from_settings', () => {
    const form = buildSettingsForm();

    resetSettingsForm(form, settings);

    expect(form.controls.highlightMe.value).toBe(false);
  });

  it('should_include_the_language_in_the_update_request', () => {
    const form = buildSettingsForm();
    form.patchValue({ gitlabUrl: 'https://gitlab.com', language: 'en' });

    expect(toUpdateRequest(form)).toEqual(expect.objectContaining({ language: 'en' }));
  });

  it('should_reset_the_language_from_settings', () => {
    const form = buildSettingsForm();

    resetSettingsForm(form, settings);

    expect(form.controls.language.value).toBe('en');
  });
});

describe('resetSettingsFormToDefaults', () => {
  it('should_reset_every_section_to_its_default_value', () => {
    const form = buildSettingsForm();
    form.patchValue({
      gitlabUrl: 'https://autre.exemple.fr',
      meUsername: 'mdupont',
      meEmail: 'marie@exemple.fr',
      refreshIntervalMin: 30,
      pauseWhenHidden: false,
      easyFiles: 1,
      openInNewTab: true,
      ignoreWip: true,
      notifyAssigned: true,
      tabBadge: true,
      theme: 'dark',
      highlightMe: false,
      language: 'en',
    });

    resetSettingsFormToDefaults(form);

    expect(form.getRawValue()).toEqual(
      expect.objectContaining({
        gitlabUrl: DEFAULT_GITLAB_URL,
        meUsername: '',
        meEmail: '',
        refreshIntervalMin: 5,
        pauseWhenHidden: true,
        ...DEFAULT_THRESHOLDS,
        openInNewTab: false,
        ignoreWip: false,
        notifyAssigned: false,
        tabBadge: false,
        theme: 'system',
        highlightMe: true,
        language: 'fr',
      }),
    );
  });

  it('should_mark_the_form_dirty_without_touching_the_token_or_the_repos', () => {
    const form = buildSettingsForm();
    form.controls.gitlabToken.setValue('glpat-should-survive');
    form.controls.repos.push(
      buildRepoAliasGroup({
        id: 1,
        pathWithNamespace: 'equipe/backend-api',
        alias: 'api',
        gitlabProjectId: 42,
      }),
    );
    form.markAsPristine();

    resetSettingsFormToDefaults(form);

    expect(form.dirty).toBe(true);
    expect(form.controls.gitlabToken.value).toBe('glpat-should-survive');
    expect(form.controls.gitlabToken.dirty).toBe(false);
    expect(form.controls.repos.length).toBe(1);
    expect(form.controls.repos.dirty).toBe(false);
  });
});

describe('threshold controls', () => {
  it('should_build_with_default_thresholds_and_be_valid', () => {
    const form = buildSettingsForm();

    expect(form.controls.easyFiles.value).toBe(DEFAULT_THRESHOLDS.easyFiles);
    expect(form.controls.easyLines.value).toBe(DEFAULT_THRESHOLDS.easyLines);
    expect(form.controls.hardFiles.value).toBe(DEFAULT_THRESHOLDS.hardFiles);
    expect(form.controls.hardLines.value).toBe(DEFAULT_THRESHOLDS.hardLines);
    expect(form.controls.readyGreenDays.value).toBe(DEFAULT_THRESHOLDS.readyGreenDays);
    expect(form.controls.readyOrangeDays.value).toBe(DEFAULT_THRESHOLDS.readyOrangeDays);
    expect(form.controls.workdaysOnly.value).toBe(DEFAULT_THRESHOLDS.workdaysOnly);
    expect(form.controls.hardFiles.valid).toBe(true);
    expect(form.controls.hardLines.valid).toBe(true);
    expect(form.controls.readyOrangeDays.valid).toBe(true);
  });

  it('should_reject_hard_files_not_greater_than_easy_files', () => {
    const form = buildSettingsForm();

    form.controls.hardFiles.setValue(5);
    form.controls.easyFiles.setValue(5);

    expect(form.controls.hardFiles.hasError('mustExceed')).toBe(true);
    expect(form.valid).toBe(false);
  });

  it('should_revalidate_hard_files_when_easy_files_changes', () => {
    const form = buildSettingsForm();
    form.controls.hardFiles.setValue(5);
    form.controls.easyFiles.setValue(5);
    expect(form.controls.hardFiles.hasError('mustExceed')).toBe(true);

    form.controls.easyFiles.setValue(2);

    expect(form.controls.hardFiles.hasError('mustExceed')).toBe(false);
    expect(form.controls.hardFiles.valid).toBe(true);
  });

  it('should_reject_hard_lines_not_greater_than_easy_lines', () => {
    const form = buildSettingsForm();

    form.controls.hardLines.setValue(100);
    form.controls.easyLines.setValue(100);

    expect(form.controls.hardLines.hasError('mustExceed')).toBe(true);
  });

  it('should_reject_ready_orange_not_greater_than_ready_green', () => {
    const form = buildSettingsForm();

    form.controls.readyGreenDays.setValue(3);
    form.controls.readyOrangeDays.setValue(3);

    expect(form.controls.readyOrangeDays.hasError('mustExceed')).toBe(true);
  });

  it('should_keep_the_min_error_alongside_the_cross_field_error', () => {
    const form = buildSettingsForm();
    form.controls.easyFiles.setValue(5);

    form.controls.hardFiles.setValue(-1);

    expect(form.controls.hardFiles.hasError('min')).toBe(true);
    expect(form.controls.hardFiles.hasError('mustExceed')).toBe(true);
  });

  it('should_reject_a_non_integer_value', () => {
    const form = buildSettingsForm();

    form.controls.easyLines.setValue(2.5);

    expect(form.controls.easyLines.hasError('integer')).toBe(true);
    expect(form.valid).toBe(false);
  });

  it('should_include_thresholds_in_the_update_request', () => {
    const form = buildSettingsForm();
    form.patchValue({
      gitlabUrl: 'https://gitlab.com',
      easyFiles: 10,
      easyLines: 200,
      hardFiles: 30,
      hardLines: 900,
      readyGreenDays: 2,
      readyOrangeDays: 5,
      workdaysOnly: true,
    });

    expect(toUpdateRequest(form)).toEqual(
      expect.objectContaining({
        easyFiles: 10,
        easyLines: 200,
        hardFiles: 30,
        hardLines: 900,
        readyGreenDays: 2,
        readyOrangeDays: 5,
        workdaysOnly: true,
      }),
    );
  });
});
