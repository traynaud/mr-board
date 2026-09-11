/** Miroir de `ProjectResponseDto` (backend). */
export interface Project {
  /** Identifiant interne — à utiliser pour renommer/supprimer, pas `gitlabProjectId`. */
  id: number;
  pathWithNamespace: string;
  alias: string;
  gitlabProjectId: number;
}

/** Corps de `POST /projects`. `alias` omis = dérivé du chemin par le backend (RG-003-05). */
export interface CreateProjectRequest {
  path: string;
  alias?: string;
}

/** Corps de `PUT /projects/:id`. */
export interface UpdateProjectRequest {
  alias: string;
}
