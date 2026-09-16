/** Forge types a connection can point to (RG-019-01, RG-020-01). */
export type ConnectionType = 'gitlab' | 'github';

/**
 * Mon identité sur une connexion, résolue automatiquement depuis son jeton
 * (RG-031-02) — jamais saisie. Utilisée par « Mes MRs » (RG-G09) et affichée
 * comme « Connecté en tant que » (RG-031-06).
 */
export interface ConnectionIdentity {
  username: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
}

/** Miroir de `ConnectionResponseDto` (backend). Ne contient jamais le jeton. */
export interface Connection {
  id: number;
  type: ConnectionType;
  name: string;
  url: string;
  tokenConfigured: boolean;
  tokenHint: string | null;
  /** `null` tant qu'aucune résolution n'a réussi (RG-031-05). */
  identity: ConnectionIdentity | null;
  /** Nombre de repos rattachés à cette connexion (RG-019-10). */
  projectsCount: number;
}

/** Corps de `POST /api/v1/connections`. */
export interface CreateConnectionRequest {
  type: ConnectionType;
  name: string;
  url: string;
  token: string;
}

/** Corps de `PUT /api/v1/connections/:id`. `token` absent = jeton inchangé (RG-019-03). */
export interface UpdateConnectionRequest {
  name?: string;
  url?: string;
  token?: string;
}

/**
 * Corps de `POST /api/v1/connections/test` (RG-001-04, RG-019-14). Depuis la
 * liste ou le formulaire de modification : `connectionId` seul suffit (les
 * autres champs par défaut à la connexion enregistrée). Depuis le formulaire
 * d'ajout : `type`/`url`/`token` sont requis.
 */
export interface TestConnectionRequest {
  type?: ConnectionType;
  url?: string;
  token?: string;
  connectionId?: number;
}

/** Réponse de `POST /api/v1/connections/test` sur succès. */
export interface TestConnectionResult {
  username: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  expiresAt: string | null;
  expirationKnown: boolean;
  /** Faux quand la forge n'a pas pu exposer les permissions du jeton (RG-020-03 : jeton GitHub fine-grained). */
  scopeKnown: boolean;
}

/** État du test de connexion (RG-001-04/05), partagé entre `ConnectionsStore` et ses composants. */
export interface TestConnectionState {
  status: 'idle' | 'pending' | 'success' | 'error';
  result: TestConnectionResult | null;
  /** Clé i18n de l'erreur (`errors.*`). */
  errorKey: string | null;
}
