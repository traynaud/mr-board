import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * US-029 — association table for the users who actually approved a merge
 * request (RG-029-01), independent of `merge_request_reviewers`. Carries
 * `position` from creation (forge order), unlike `merge_request_reviewers`/
 * `merge_request_assignees` which needed a later `ALTER TABLE` for it.
 */
export class AddMergeRequestApprovers1757601900000 implements MigrationInterface {
  name = 'AddMergeRequestApprovers1757601900000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "merge_request_approvers" (
        "merge_request_id" integer NOT NULL,
        "user_id" integer NOT NULL,
        "position" integer NOT NULL DEFAULT 0,
        PRIMARY KEY ("merge_request_id", "user_id"),
        CONSTRAINT "FK_mr_approvers_merge_request" FOREIGN KEY ("merge_request_id") REFERENCES "merge_requests" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_mr_approvers_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "merge_request_approvers"`);
  }
}
