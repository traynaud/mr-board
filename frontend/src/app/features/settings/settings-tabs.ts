import { SettingsForm, SettingsFormControls } from './settings-form';

/** Onglets de l'écran Paramètres, dans l'ordre d'affichage (RG-042-01). */
export const SETTINGS_TABS = ['connections', 'data', 'display', 'notifications'] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

/** Onglet ouvert par défaut, ou quand `?tab=` est absent / inconnu (RG-042-03). */
export const DEFAULT_SETTINGS_TAB: SettingsTab = 'connections';

/** Lit `?tab=` ; toute valeur inconnue retombe sur le premier onglet (RG-042-03). */
export function parseSettingsTab(raw: string | null): SettingsTab {
  return (SETTINGS_TABS as readonly string[]).includes(raw ?? '')
    ? (raw as SettingsTab)
    : DEFAULT_SETTINGS_TAB;
}

/** Contrôles du formulaire (unique pour tous les onglets, RG-042-02) rattachés à chaque onglet. */
const TAB_CONTROLS: Record<SettingsTab, readonly (keyof SettingsFormControls)[]> = {
  connections: ['repos'],
  data: ['refreshIntervalMin', 'pauseWhenHidden', 'historyRetentionDays', 'historyMaxEvents'],
  display: [
    'easyFiles',
    'easyLines',
    'hardFiles',
    'hardLines',
    'readyGreenDays',
    'readyOrangeDays',
    'workdaysOnly',
    'highlightMe',
    'theme',
    'language',
    'openInNewTab',
    'ignoreWip',
  ],
  notifications: [
    'notifDisabledTypes',
    'notifOnlyMine',
    'notifExcludeOwn',
    'notifyAssigned',
    'tabBadge',
  ],
};

/** Pastille d'un onglet : erreur de validation, ou modification non enregistrée (RG-042-03). */
export type TabMark = 'error' | 'dirty' | null;

/** `error` prime sur `dirty` ; `null` quand l'onglet est valide et intact. */
export function tabMark(form: SettingsForm, tab: SettingsTab): TabMark {
  const controls = TAB_CONTROLS[tab].map((name) => form.controls[name]);
  if (controls.some((control) => control.invalid)) {
    return 'error';
  }
  return controls.some((control) => control.dirty) ? 'dirty' : null;
}
