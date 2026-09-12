import { MigrationInterface, QueryRunner } from 'typeorm';

/** US-015 — Miscellaneous settings: new-tab links and ignored labels. */
export class AddMiscSettings1757600700000 implements MigrationInterface {
  name = 'AddMiscSettings1757600700000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "open_in_new_tab" boolean NOT NULL DEFAULT (0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "ignored_labels" text NOT NULL DEFAULT ('[]')`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "open_in_new_tab"`,
    );
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "ignored_labels"`,
    );
  }
}
