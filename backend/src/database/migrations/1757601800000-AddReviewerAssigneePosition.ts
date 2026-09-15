import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bugfix (QA US-023 BUG-002, RG-G06) — SQLite restitues
 * `merge_request_reviewers`/`merge_request_assignees` rows ordered by their
 * composite primary key (`user_id`) rather than insertion order, so the
 * forge's reviewer/assignee order was never preserved. `position` records
 * the insertion order so it can be used to sort on read.
 */
export class AddReviewerAssigneePosition1757601800000 implements MigrationInterface {
  name = 'AddReviewerAssigneePosition1757601800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "merge_request_reviewers" ADD COLUMN "position" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "merge_request_assignees" ADD COLUMN "position" integer NOT NULL DEFAULT 0`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "merge_request_assignees" DROP COLUMN "position"`,
    );
    await queryRunner.query(
      `ALTER TABLE "merge_request_reviewers" DROP COLUMN "position"`,
    );
  }
}
