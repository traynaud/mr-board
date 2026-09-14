import { MigrationInterface, QueryRunner } from 'typeorm';

/** US-027 — favorites table, identified by (project_id, iid) (RG-027-04). */
export class AddFavorites1757601700000 implements MigrationInterface {
  name = 'AddFavorites1757601700000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "favorites" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "project_id" integer NOT NULL,
        "iid" integer NOT NULL,
        "created_at" text NOT NULL,
        CONSTRAINT "UQ_favorites_project_iid" UNIQUE ("project_id", "iid"),
        CONSTRAINT "FK_favorites_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "favorites"`);
  }
}
