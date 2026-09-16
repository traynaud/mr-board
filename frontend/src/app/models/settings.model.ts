import { ConnectionType } from './connection.model';

/** Préférence de thème (RG-018-01) : `system` suit l'OS, `light`/`dark` la forcent. */
export type ThemePreference = 'system' | 'light' | 'dark';

/** Langue de l'interface (RG-022-01). */
export type Language = 'fr' | 'en';

/**
 * Miroir de `SettingsResponseDto` (backend) : préférences globales
 * uniquement (RG-019-23) — l'URL, le jeton et le nom d'utilisateur GitLab
 * ont migré vers `Connection` (US-019).
 */
export interface Settings {
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
 * Corps de `PUT /settings` — préférences globales uniquement (RG-019-23) ;
 * mon identité n'en fait plus partie, elle est résolue depuis le jeton de
 * chaque connexion (RG-031-02).
 */
export interface UpdateSettingsRequest {
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

/** Une connexion telle qu'exportée/importée (RG-019-18/19). Ne contient jamais le jeton. */
export interface TransferConnection {
  type: ConnectionType;
  name: string;
  url: string;
}

/** Un repo tel qu'exporté/importé (RG-015-03/04, RG-019-18/19) : jamais son id interne. */
export interface TransferProject {
  /** Nom de la connexion à laquelle ce repo est rattaché (RG-019-18/19). */
  connection: string;
  pathWithNamespace: string;
  alias: string;
  /** Absent = fichier exporté avant US-025 ; présent (même `null`) écrase toujours la couleur existante (RG-025-08). */
  color?: string | null;
}

/** Un favori tel qu'exporté/importé (RG-027-15). */
export interface TransferFavorite {
  /** Nom de la connexion à laquelle le repo de cette MR est rattaché. */
  connection: string;
  pathWithNamespace: string;
  iid: number;
}

/** Réponse de `GET /settings/export` (RG-019-18, RG-027-15). Ne contient jamais de jeton. */
export interface ExportConfig {
  version: 2;
  settings: Settings;
  connections: TransferConnection[];
  projects: TransferProject[];
  favorites: TransferFavorite[];
}

/**
 * Corps de `POST /settings/import` (RG-015-04, RG-019-19).
 * `version: 1` (avant US-019) : `settings` porte encore `gitlabUrl`/
 * `meUsername`, `projects` n'a pas de `connection`, `connections` est absent.
 * `version: 2` : forme courante.
 */
export interface ImportConfig {
  version: 1 | 2;
  settings: Partial<Settings> & {
    /** `version: 1` seulement. */
    gitlabUrl?: string;
    /**
     * Champ hérité d'un export antérieur à US-031, accepté mais ignoré par
     * le backend (RG-031-14) — l'identité est désormais résolue depuis le
     * jeton, jamais importée.
     */
    meUsername?: string;
  };
  connections?: TransferConnection[];
  projects: (TransferProject | Omit<TransferProject, 'connection'>)[];
  /** `version: 2` seulement ; absent/ignoré sur un fichier `version: 1` (RG-027-15). */
  favorites?: TransferFavorite[];
}

/** Réponse de `POST /settings/import`. */
export interface ImportResult {
  settings: Settings;
  connectionsAdded: number;
  connectionsUpdated: number;
  /** Noms des connexions nouvellement créées — toujours sans jeton (RG-019-19). */
  newConnectionNames: string[];
  projectsAdded: number;
  projectsUpdated: number;
  projectsSkipped: { pathWithNamespace: string; reason: string }[];
}
