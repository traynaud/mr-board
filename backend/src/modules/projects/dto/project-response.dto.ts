/** Response of every `/api/v1/projects` endpoint. */
export class ProjectResponseDto {
  /** Internal id — use this for `PUT`/`DELETE`, not `gitlabProjectId`. */
  id!: number;
  pathWithNamespace!: string;
  alias!: string;
  gitlabProjectId!: number;
}
