import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { ConnectionType } from '../../forges/types/connection-type.js';

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

  /**
   * My identity on this connection, resolved automatically from its token
   * (RG-031-02) — never entered by hand. `null` on all four columns until a
   * resolution has succeeded at least once (no token yet, or every attempt
   * so far has failed). Used by "Mes MRs" (RG-G09, RG-031-08) and displayed
   * as "Connecté en tant que" (RG-031-06). A failed resolution never clears
   * a previously resolved value (RG-031-03).
   */
  @Column({ name: 'resolved_username', type: 'text', nullable: true })
  resolvedUsername!: string | null;

  @Column({ name: 'resolved_name', type: 'text', nullable: true })
  resolvedName!: string | null;

  @Column({ name: 'resolved_email', type: 'text', nullable: true })
  resolvedEmail!: string | null;

  @Column({ name: 'resolved_avatar_url', type: 'text', nullable: true })
  resolvedAvatarUrl!: string | null;

  @Column({ name: 'created_at', type: 'text' })
  createdAt!: string;

  @Column({ name: 'updated_at', type: 'text' })
  updatedAt!: string;
}
