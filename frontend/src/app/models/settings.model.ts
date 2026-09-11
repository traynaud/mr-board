/** Miroir de `SettingsResponseDto` (backend). Ne contient jamais le jeton. */
export interface Settings {
  gitlabUrl: string;
  tokenConfigured: boolean;
  tokenHint: string | null;
  /** Username GitLab de l'utilisateur courant, utilisé par « Mes MRs » (RG-002-01). */
  meUsername: string | null;
  /** Email de repli pour la correspondance (RG-002-01, RG-G09). */
  meEmail: string | null;
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
