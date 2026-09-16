import { ConnectionType } from '../../forges/types/connection-type.js';
import { ConnectionIdentityDto } from './connection-identity.dto.js';

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
  /**
   * My identity on this connection, resolved from its token (RG-031-02) —
   * `null` until a resolution has succeeded (no token, or every attempt so
   * far has failed). Used by "Mes MRs" (RG-G09) and displayed as "Connecté
   * en tant que" (RG-031-06).
   */
  identity!: ConnectionIdentityDto | null;
  /** Number of repos attached to this connection (RG-019-10). */
  projectsCount!: number;
}
