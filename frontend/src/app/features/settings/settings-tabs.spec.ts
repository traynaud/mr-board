import { buildSettingsForm } from './settings-form';
import { DEFAULT_SETTINGS_TAB, SETTINGS_TABS, parseSettingsTab, tabMark } from './settings-tabs';

describe('parseSettingsTab (RG-042-03)', () => {
  it.each(SETTINGS_TABS)('should_accept_the_%s_tab', (tab) => {
    expect(parseSettingsTab(tab)).toBe(tab);
  });

  it.each([null, '', 'xyz', 'Notifications'])('should_fall_back_to_the_first_tab_for_%s', (raw) => {
    expect(parseSettingsTab(raw)).toBe(DEFAULT_SETTINGS_TAB);
    expect(DEFAULT_SETTINGS_TAB).toBe(SETTINGS_TABS[0]);
  });
});

describe('tabMark (RG-042-03)', () => {
  it('should_be_null_for_a_pristine_valid_form', () => {
    const form = buildSettingsForm();
    expect(SETTINGS_TABS.map((tab) => tabMark(form, tab))).toEqual([null, null, null, null]);
  });

  it('should_flag_only_the_tab_that_holds_an_edit', () => {
    const form = buildSettingsForm();
    form.controls.notifOnlyMine.setValue(true);
    form.controls.notifOnlyMine.markAsDirty();

    expect(tabMark(form, 'notifications')).toBe('dirty');
    expect(tabMark(form, 'display')).toBeNull();
    expect(tabMark(form, 'data')).toBeNull();
  });

  it('should_prefer_error_over_dirty', () => {
    const form = buildSettingsForm();
    form.controls.easyFiles.setValue(0);
    form.controls.easyFiles.markAsDirty();

    expect(tabMark(form, 'display')).toBe('error');
  });

  it('should_map_the_history_retention_and_refresh_to_the_data_tab', () => {
    const form = buildSettingsForm();
    form.controls.historyMaxEvents.setValue(1);

    expect(tabMark(form, 'data')).toBe('error');
    expect(tabMark(form, 'display')).toBeNull();
  });
});
