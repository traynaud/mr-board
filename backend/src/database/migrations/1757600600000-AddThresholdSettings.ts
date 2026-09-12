import { MigrationInterface, QueryRunner } from 'typeorm';

/** US-014 — Difficulty and Ready delay threshold settings (RG-G03, RG-G04). */
export class AddThresholdSettings1757600600000 implements MigrationInterface {
  name = 'AddThresholdSettings1757600600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "easy_files" integer NOT NULL DEFAULT (5)`,
    );
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "easy_lines" integer NOT NULL DEFAULT (100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "hard_files" integer NOT NULL DEFAULT (20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "hard_lines" integer NOT NULL DEFAULT (800)`,
    );
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "ready_green_days" integer NOT NULL DEFAULT (1)`,
    );
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "ready_orange_days" integer NOT NULL DEFAULT (3)`,
    );
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "workdays_only" boolean NOT NULL DEFAULT (0)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "easy_files"`);
    await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "easy_lines"`);
    await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "hard_files"`);
    await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "hard_lines"`);
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "ready_green_days"`,
    );
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "ready_orange_days"`,
    );
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "workdays_only"`,
    );
  }
}
