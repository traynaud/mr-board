/** A repository resolved on a forge, already normalised by the forge's own mapper (US-019). */
export interface ForgeProject {
  remoteProjectId: string;
  pathWithNamespace: string;
  webUrl: string;
}
