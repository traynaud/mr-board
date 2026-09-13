/** Miroir de `ProjectResponseDto` (backend). */
export interface Project {
  /** Identifiant interne — à utiliser pour renommer/supprimer, pas `remoteProjectId`. */
  id: number;
  connectionId: number;
  pathWithNamespace: string;
  alias: string;
  remoteProjectId: string;
}

/**
 * Corps de `POST /projects`. `alias` omis = dérivé du chemin par le backend
 * (RG-003-05). `connectionId` obligatoire si ≥ 2 connexions, implicite sinon
 * (RG-019-15).
 */
export interface CreateProjectRequest {
  path: string;
  alias?: string;
  connectionId?: number;
}

/** Corps de `PUT /projects/:id`. */
export interface UpdateProjectRequest {
  alias: string;
}
