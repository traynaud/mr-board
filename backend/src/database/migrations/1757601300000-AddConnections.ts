import { MigrationInterface, QueryRunner } from 'typeorm';

/** US-019 — connections table (multi-forge socle). */
export class AddConnections1757601300000 implements MigrationInterface {
  name = 'AddConnections1757601300000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "connections" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "type" text NOT NULL,
        "name" text NOT NULL COLLATE NOCASE,
        "url" text NOT NULL,
        "token_encrypted" text NULL,
        "me_username" text NULL,
        "created_at" text NOT NULL,
        "updated_at" text NOT NULL,
        CONSTRAINT "UQ_connections_name" UNIQUE ("name")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "connections"`);
  }
}
