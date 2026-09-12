import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * US-006 — `merge_requests.changed_files`/`additions`/`deletions` become
 * nullable, to distinguish a real zero-file MR from a MR whose diff stats
 * were unavailable at sync time (RG-006-02). SQLite has no `ALTER COLUMN`:
 * the table is recreated, its rows copied with their original `id` (so the
 * `merge_request_reviewers`/`merge_request_assignees` foreign keys still
 * resolve correctly after the rename — TypeORM disables `foreign_keys`
 * around migrations, so the intermediate `DROP TABLE` does not cascade).
 */
export class AllowNullDiffStats1757600400000 implements MigrationInterface {
  name = 'AllowNullDiffStats1757600400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "merge_requests_new" (
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
        "changed_files" integer NULL,
        "additions" integer NULL,
        "deletions" integer NULL,
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
    await queryRunner.query(`
      INSERT INTO "merge_requests_new" (
        "id", "gitlab_mr_id", "iid", "project_id", "title", "web_url", "draft",
        "author_id", "approved", "comments_count", "changed_files", "additions",
        "deletions", "labels", "created_at_gitlab", "ready_at", "updated_at_gitlab", "synced_at"
      )
      SELECT
        "id", "gitlab_mr_id", "iid", "project_id", "title", "web_url", "draft",
        "author_id", "approved", "comments_count", "changed_files", "additions",
        "deletions", "labels", "created_at_gitlab", "ready_at", "updated_at_gitlab", "synced_at"
      FROM "merge_requests"
    `);
    await queryRunner.query(`DROP TABLE "merge_requests"`);
    await queryRunner.query(
      `ALTER TABLE "merge_requests_new" RENAME TO "merge_requests"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_merge_requests_project_id" ON "merge_requests" ("project_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_merge_requests_ready_at" ON "merge_requests" ("ready_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_merge_requests_draft" ON "merge_requests" ("draft")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "merge_requests_old" (
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
    await queryRunner.query(`
      INSERT INTO "merge_requests_old" (
        "id", "gitlab_mr_id", "iid", "project_id", "title", "web_url", "draft",
        "author_id", "approved", "comments_count", "changed_files", "additions",
        "deletions", "labels", "created_at_gitlab", "ready_at", "updated_at_gitlab", "synced_at"
      )
      SELECT
        "id", "gitlab_mr_id", "iid", "project_id", "title", "web_url", "draft",
        "author_id", "approved", "comments_count",
        COALESCE("changed_files", 0), COALESCE("additions", 0), COALESCE("deletions", 0),
        "labels", "created_at_gitlab", "ready_at", "updated_at_gitlab", "synced_at"
      FROM "merge_requests"
    `);
    await queryRunner.query(`DROP TABLE "merge_requests"`);
    await queryRunner.query(
      `ALTER TABLE "merge_requests_old" RENAME TO "merge_requests"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_merge_requests_project_id" ON "merge_requests" ("project_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_merge_requests_ready_at" ON "merge_requests" ("ready_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_merge_requests_draft" ON "merge_requests" ("draft")`,
    );
  }
}
