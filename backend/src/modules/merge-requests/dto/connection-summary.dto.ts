import { ConnectionType } from '../../forges/types/connection-type.js';

/** Connection a merge request's project belongs to, embedded in `MergeRequestViewDto` (RG-019-22). */
export class ConnectionSummaryDto {
  id!: number;
  name!: string;
  type!: ConnectionType;
}
