import { MigrationInterface, QueryRunner } from 'typeorm';

/** US-036 — history retention: maximum age (days) and maximum number of events. */
export class AddHistoryRetentionSettings1757602400000 implements MigrationInterface {
  name = 'AddHistoryRetentionSettings1757602400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "history_retention_days" integer NOT NULL DEFAULT (60)`,
    );
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "history_max_events" integer NOT NULL DEFAULT (5000)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "history_max_events"`,
    );
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "history_retention_days"`,
    );
  }
}
