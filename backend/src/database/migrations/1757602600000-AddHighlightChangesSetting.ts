import { MigrationInterface, QueryRunner } from 'typeorm';

/** US-043 — Highlight new / modified merge requests in the table (enabled by default). */
export class AddHighlightChangesSetting1757602600000 implements MigrationInterface {
  name = 'AddHighlightChangesSetting1757602600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "highlight_changes" boolean NOT NULL DEFAULT (1)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "highlight_changes"`,
    );
  }
}
