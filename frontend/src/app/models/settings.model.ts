/** Miroir de `SettingsResponseDto` (backend). Ne contient jamais le jeton. */
export interface Settings {
  gitlabUrl: string;
  tokenConfigured: boolean;
  tokenHint: string | null;
}

/** Corps de `PUT /settings`. `gitlabToken` absent = jeton inchangé. */
export interface UpdateSettingsRequest {
  gitlabUrl: string;
  gitlabToken?: string;
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
