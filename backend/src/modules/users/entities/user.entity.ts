import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A GitLab user encountered while synchronising merge requests (author,
 * reviewer or assignee). Upserted by `gitlab_user_id`. See US-004.
 */
@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'gitlab_user_id', type: 'integer' })
  gitlabUserId!: number;

  @Column({ type: 'text' })
  username!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl!: string | null;

  @Column({ name: 'web_url', type: 'text' })
  webUrl!: string;
}
