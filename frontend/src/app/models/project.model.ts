/** Miroir de `ProjectResponseDto` (backend). */
export interface Project {
  /** Identifiant interne — à utiliser pour renommer/supprimer, pas `remoteProjectId`. */
  id: number;
  connectionId: number;
  pathWithNamespace: string;
  alias: string;
  remoteProjectId: string;
  /** Id de couleur (`ProjectColorId`) du tag Projet, `null` = « Aucune » (RG-025-01). */
  color: string | null;
}

/**
 * Corps de `POST /projects`. `alias` omis = dérivé du chemin par le backend
 * (RG-003-05). `connectionId` obligatoire si ≥ 2 connexions, implicite sinon
 * (RG-019-15). `color` omis = « Aucune » (RG-025-07).
 */
export interface CreateProjectRequest {
  path: string;
  alias?: string;
  connectionId?: number;
  color?: string | null;
}

/** Corps de `PUT /api/v1/projects/:id`. `color` toujours envoyé, `null` = « Aucune » (RG-025-01, RG-025-07). */
export interface UpdateProjectRequest {
  alias: string;
  color: string | null;
}
