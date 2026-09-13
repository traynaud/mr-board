/** Préférence de thème (RG-018-01) : `system` suit l'OS, `light`/`dark` la forcent. */
export type ThemePreference = 'system' | 'light' | 'dark';

/** Langue de l'interface (RG-022-01). */
export type Language = 'fr' | 'en';

/** Miroir de `SettingsResponseDto` (backend). Ne contient jamais le jeton. */
export interface Settings {
  gitlabUrl: string;
  tokenConfigured: boolean;
  tokenHint: string | null;
  /** Username GitLab de l'utilisateur courant, utilisé par « Mes MRs » (RG-002-01). */
  meUsername: string | null;
  /** Email de repli pour la correspondance (RG-002-01, RG-G09). */
  meEmail: string | null;
  /** Cadence de synchro planifiée en minutes ; `0` = manuel (RG-013-01). */
  refreshIntervalMin: number;
  /** Met en pause le polling frontend quand l'onglet est masqué (RG-013-05). */
  pauseWhenHidden: boolean;
  /** Seuils de difficulté (RG-G03, RG-014-01). */
  easyFiles: number;
  easyLines: number;
  hardFiles: number;
  hardLines: number;
  /** Seuils de délai Ready en jours (RG-G04, RG-014-01). */
  readyGreenDays: number;
  readyOrangeDays: number;
  /** Ne compter que les jours ouvrés pour le délai Ready (RG-G04, RG-014-01). */
  workdaysOnly: boolean;
  /** Ouvre les MRs dans un nouvel onglet (RG-G11, RG-015-01). */
  openInNewTab: boolean;
  /** Labels masquant une MR, comparaison insensible à la casse (RG-015-02). */
  ignoredLabels: string[];
  /** Notification navigateur quand une MR m'est nouvellement assignée (RG-016-01/02). */
  notifyAssigned: boolean;
  /** Badge dans le titre de l'onglet comptant les MRs au niveau Ready rouge (RG-016-04). */
  tabBadge: boolean;
  /** Préférence de thème (RG-018-01). */
  theme: ThemePreference;
  /** Surligne mon avatar (auteur, reviewer, affecté) dans le tableau (RG-023-01). */
  highlightMe: boolean;
  /** Langue de l'interface (RG-022-01). */
  language: Language;
}

/**
 * Corps de `PUT /settings`. `gitlabToken` absent = jeton inchangé.
 * `meUsername`/`meEmail` suivent une sémantique différente (RG-002-02) :
 * absent = inchangé, mais chaîne vide = efface la valeur existante.
 */
export interface UpdateSettingsRequest {
  gitlabUrl: string;
  gitlabToken?: string;
  meUsername?: string;
  meEmail?: string;
  refreshIntervalMin?: number;
  pauseWhenHidden?: boolean;
  easyFiles?: number;
  easyLines?: number;
  hardFiles?: number;
  hardLines?: number;
  readyGreenDays?: number;
  readyOrangeDays?: number;
  workdaysOnly?: boolean;
  openInNewTab?: boolean;
  ignoredLabels?: string[];
  notifyAssigned?: boolean;
  tabBadge?: boolean;
  theme?: ThemePreference;
  highlightMe?: boolean;
  language?: Language;
}

/** Corps de `POST /settings/test-connection`. `gitlabToken` absent = jeton enregistré. */
export interface TestConnectionRequest {
  gitlabUrl: string;
  gitlabToken?: string;
}

/** Réponse de `POST /settings/test-connection`. */
export interface TestConnectionResult {
  username: string;
  name: string;
  avatarUrl: string | null;
  expiresAt: string | null;
  expirationKnown: boolean;
}

/** Un repo tel qu'exporté/importé (RG-015-03/04) : jamais son id interne. */
export interface TransferProject {
  pathWithNamespace: string;
  alias: string;
}

/** Réponse de `GET /settings/export`. Ne contient jamais le jeton (RG-015-03). */
export interface ExportConfig {
  version: 1;
  settings: Omit<Settings, 'tokenConfigured' | 'tokenHint'>;
  projects: TransferProject[];
}

/**
 * Corps de `POST /settings/import` (RG-015-04). `settings` reprend la forme
 * de `UpdateSettingsRequest` sans `gitlabToken` (jamais importé) : tout le
 * reste est optionnel, un fichier importé n'étant pas garanti d'être un
 * export complet.
 */
export interface ImportConfig {
  version: number;
  settings: Omit<UpdateSettingsRequest, 'gitlabToken'>;
  projects: TransferProject[];
}

/** Réponse de `POST /settings/import`. */
export interface ImportResult {
  settings: Settings;
  projectsAdded: number;
  projectsUpdated: number;
  projectsSkipped: { pathWithNamespace: string; reason: string }[];
}
