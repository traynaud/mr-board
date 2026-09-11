/** Subset of `GET /api/v4/projects/:id`. */
export interface GitlabProject {
  id: number;
  path_with_namespace: string;
  web_url: string;
}
