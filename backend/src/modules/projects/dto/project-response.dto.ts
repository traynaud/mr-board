/** Response of every `/api/v1/projects` endpoint. */
export class ProjectResponseDto {
  /** Internal id — use this for `PUT`/`DELETE`, not `remoteProjectId`. */
  id!: number;
  connectionId!: number;
  pathWithNamespace!: string;
  alias!: string;
  remoteProjectId!: string;
  color!: string | null;
}
