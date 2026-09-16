import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * US-031 — replaces the manually-entered `connections.me_username` (RG-019-08)
 * and the global `settings.me_email` fallback (RG-002-01) with an identity
 * resolved automatically from each connection's token (RG-031-02):
 * `resolved_username`/`resolved_name`/`resolved_email`/`resolved_avatar_url`.
 * `resolved_username` is seeded from `me_username` so "Mes MRs" keeps working
 * until the first post-migration resolution (RG-031-13) ; the other three
 * columns start `NULL`, unknown before that first resolution.
 */
export class AddResolvedIdentityToConnections1757602000000 implements MigrationInterface {
  name = 'AddResolvedIdentityToConnections1757602000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "connections" ADD COLUMN "resolved_username" text NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "connections" ADD COLUMN "resolved_name" text NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "connections" ADD COLUMN "resolved_email" text NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "connections" ADD COLUMN "resolved_avatar_url" text NULL`,
    );
    await queryRunner.query(
      `UPDATE "connections" SET "resolved_username" = "me_username"`,
    );
    await queryRunner.query(
      `ALTER TABLE "connections" DROP COLUMN "me_username"`,
    );
    await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "me_email"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "me_email" text NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "connections" ADD COLUMN "me_username" text NULL`,
    );
    await queryRunner.query(
      `UPDATE "connections" SET "me_username" = "resolved_username"`,
    );
    await queryRunner.query(
      `ALTER TABLE "connections" DROP COLUMN "resolved_avatar_url"`,
    );
    await queryRunner.query(
      `ALTER TABLE "connections" DROP COLUMN "resolved_email"`,
    );
    await queryRunner.query(
      `ALTER TABLE "connections" DROP COLUMN "resolved_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "connections" DROP COLUMN "resolved_username"`,
    );
  }
}
