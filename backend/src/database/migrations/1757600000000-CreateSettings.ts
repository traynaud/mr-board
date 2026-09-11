import { MigrationInterface, QueryRunner } from 'typeorm';

/** US-001 — settings singleton (GitLab URL + encrypted token). */
export class CreateSettings1757600000000 implements MigrationInterface {
  name = 'CreateSettings1757600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "settings" (
        "id" integer PRIMARY KEY NOT NULL CHECK ("id" = 1),
        "gitlab_url" text NOT NULL DEFAULT 'https://gitlab.com',
        "gitlab_token_encrypted" text NULL,
        "updated_at" text NOT NULL
      )
    `);
    await queryRunner.query(
      `INSERT OR IGNORE INTO "settings" ("id", "gitlab_url", "updated_at") VALUES (1, 'https://gitlab.com', ?)`,
      [new Date().toISOString()],
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "settings"`);
  }
}
