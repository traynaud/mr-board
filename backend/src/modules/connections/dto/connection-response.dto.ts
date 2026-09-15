import { ConnectionType } from '../../forges/types/connection-type.js';

/** Response of every `/api/v1/connections` endpoint. Never carries the token. */
export class ConnectionResponseDto {
  id!: number;
  type!: ConnectionType;
  name!: string;
  url!: string;
  /** True when a readable token is stored. */
  tokenConfigured!: boolean;
  /** Last characters of the stored token, `null` when none. */
  tokenHint!: string | null;
  /** My username on this connection, used by "Mes MRs" (RG-019-07). */
  meUsername!: string | null;
  /** Number of repos attached to this connection (RG-019-10). */
  projectsCount!: number;
}
