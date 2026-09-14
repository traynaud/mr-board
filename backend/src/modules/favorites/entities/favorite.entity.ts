import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A locally-marked favorite merge request (RG-027-01/02), identified by
 * (`project_id`, `iid`) — never the internal id of a `merge_requests` row,
 * which is not stable across a synchronisation (RG-027-04).
 */
@Entity({ name: 'favorites' })
export class Favorite {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'project_id', type: 'integer' })
  projectId!: number;

  @Column({ type: 'integer' })
  iid!: number;

  @Column({ name: 'created_at', type: 'text' })
  createdAt!: string;
}
