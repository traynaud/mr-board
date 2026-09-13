import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { ConnectionType } from '../../forges/types/connection-type';

/**
 * A forge instance MR Board is configured to read from (RG-019-01). Repos
 * (`projects`) and users (`users`) each belong to exactly one connection,
 * cascade-deleted with it.
 */
@Entity({ name: 'connections' })
export class Connection {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text' })
  type!: ConnectionType;

  /** Unique, case-insensitive (`COLLATE NOCASE` at the SQL level, RG-019-01). */
  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  url!: string;

  /** Encrypted token (see `TokenCipherService`), `null` when not configured (RG-019-19). */
  @Column({ name: 'token_encrypted', type: 'text', nullable: true })
  tokenEncrypted!: string | null;

  /** My username on this connection, used by "Mes MRs" (RG-019-07/08). */
  @Column({ name: 'me_username', type: 'text', nullable: true })
  meUsername!: string | null;

  @Column({ name: 'created_at', type: 'text' })
  createdAt!: string;

  @Column({ name: 'updated_at', type: 'text' })
  updatedAt!: string;
}
