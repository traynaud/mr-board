import { MigrationInterface, QueryRunner } from 'typeorm';

/** US-003 — configured GitLab repositories. */
export class CreateProjects1757600200000 implements MigrationInterface {
  name = 'CreateProjects1757600200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "gitlab_project_id" integer NOT NULL,
        "path_with_namespace" text NOT NULL,
        "alias" text NOT NULL COLLATE NOCASE,
        "web_url" text NOT NULL,
        "enabled" boolean NOT NULL DEFAULT (1),
        "created_at" text NOT NULL,
        CONSTRAINT "UQ_projects_gitlab_project_id" UNIQUE ("gitlab_project_id"),
        CONSTRAINT "UQ_projects_path_with_namespace" UNIQUE ("path_with_namespace"),
        CONSTRAINT "UQ_projects_alias" UNIQUE ("alias")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "projects"`);
  }
}
