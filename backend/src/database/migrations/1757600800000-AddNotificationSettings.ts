import { MigrationInterface, QueryRunner } from 'typeorm';

/** US-016 — Browser notifications and tab badge settings. */
export class AddNotificationSettings1757600800000 implements MigrationInterface {
  name = 'AddNotificationSettings1757600800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "notify_assigned" boolean NOT NULL DEFAULT (0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "tab_badge" boolean NOT NULL DEFAULT (0)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "notify_assigned"`,
    );
    await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "tab_badge"`);
  }
}
