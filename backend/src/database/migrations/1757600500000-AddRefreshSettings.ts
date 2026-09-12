import { MigrationInterface, QueryRunner } from 'typeorm';

/** US-013 — Automatic refresh settings (scheduled sync interval, pause when hidden). */
export class AddRefreshSettings1757600500000 implements MigrationInterface {
  name = 'AddRefreshSettings1757600500000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "refresh_interval_min" integer NOT NULL DEFAULT (5)`,
    );
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "pause_when_hidden" boolean NOT NULL DEFAULT (1)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "refresh_interval_min"`,
    );
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "pause_when_hidden"`,
    );
  }
}
