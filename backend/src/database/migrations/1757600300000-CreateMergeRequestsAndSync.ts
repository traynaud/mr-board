import { MigrationInterface, QueryRunner } from 'typeorm';

/** US-004 — GitLab users, synchronised merge requests (with reviewers/assignees) and sync runs. */
export class CreateMergeRequestsAndSync1757600300000 implements MigrationInterface {
  name = 'CreateMergeRequestsAndSync1757600300000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "gitlab_user_id" integer NOT NULL,
        "username" text NOT NULL,
        "name" text NOT NULL,
        "avatar_url" text NULL,
        "web_url" text NOT NULL,
        CONSTRAINT "UQ_users_gitlab_user_id" UNIQUE ("gitlab_user_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "merge_requests" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "gitlab_mr_id" integer NOT NULL,
        "iid" integer NOT NULL,
        "project_id" integer NOT NULL,
        "title" text NOT NULL,
        "web_url" text NOT NULL,
        "draft" boolean NOT NULL,
        "author_id" integer NOT NULL,
        "approved" boolean NOT NULL,
        "comments_count" integer NOT NULL,
        "changed_files" integer NOT NULL,
        "additions" integer NOT NULL,
        "deletions" integer NOT NULL,
        "labels" text NOT NULL,
        "created_at_gitlab" text NOT NULL,
        "ready_at" text NULL,
        "updated_at_gitlab" text NOT NULL,
        "synced_at" text NOT NULL,
        CONSTRAINT "UQ_merge_requests_project_iid" UNIQUE ("project_id", "iid"),
        CONSTRAINT "FK_merge_requests_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_merge_requests_author" FOREIGN KEY ("author_id") REFERENCES "users" ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_merge_requests_project_id" ON "merge_requests" ("project_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_merge_requests_ready_at" ON "merge_requests" ("ready_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_merge_requests_draft" ON "merge_requests" ("draft")`,
    );

    await queryRunner.query(`
      CREATE TABLE "merge_request_reviewers" (
        "merge_request_id" integer NOT NULL,
        "user_id" integer NOT NULL,
        PRIMARY KEY ("merge_request_id", "user_id"),
        CONSTRAINT "FK_mr_reviewers_merge_request" FOREIGN KEY ("merge_request_id") REFERENCES "merge_requests" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_mr_reviewers_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "merge_request_assignees" (
        "merge_request_id" integer NOT NULL,
        "user_id" integer NOT NULL,
        PRIMARY KEY ("merge_request_id", "user_id"),
        CONSTRAINT "FK_mr_assignees_merge_request" FOREIGN KEY ("merge_request_id") REFERENCES "merge_requests" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_mr_assignees_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "sync_runs" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "started_at" text NOT NULL,
        "finished_at" text NOT NULL,
        "status" text NOT NULL,
        "error_message" text NULL,
        "mr_count" integer NOT NULL,
        "trigger" text NOT NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_sync_runs_started_at" ON "sync_runs" ("started_at")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "sync_runs"`);
    await queryRunner.query(`DROP TABLE "merge_request_assignees"`);
    await queryRunner.query(`DROP TABLE "merge_request_reviewers"`);
    await queryRunner.query(`DROP TABLE "merge_requests"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
