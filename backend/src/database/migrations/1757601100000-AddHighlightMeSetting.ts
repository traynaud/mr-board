import { MigrationInterface, QueryRunner } from 'typeorm';

/** US-023 — Highlight my avatar (author/reviewer/assignee) in the merge requests table. */
export class AddHighlightMeSetting1757601100000 implements MigrationInterface {
  name = 'AddHighlightMeSetting1757601100000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "highlight_me" boolean NOT NULL DEFAULT (1)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "highlight_me"`,
    );
  }
}
