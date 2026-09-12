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
