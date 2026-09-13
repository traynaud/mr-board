/** The forge types a connection can point to (RG-019-01). Only `gitlab` is implemented so far. */
export type ConnectionType = 'gitlab' | 'github';

/** Every declared forge type, including ones not implemented yet — used by `@IsIn` validators. */
export const CONNECTION_TYPES: ConnectionType[] = ['gitlab', 'github'];
