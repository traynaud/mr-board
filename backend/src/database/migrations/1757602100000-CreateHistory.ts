import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * US-033 — history journal (`merge_request_events`), per-merge-request
 * enrichment queue (`history_queue`) and per-project baseline marker
 * (`history_baselines`). No foreign key to `merge_requests` or `users`:
 * merge requests are physically deleted when they disappear (RG-G01), and
 * the journal must outlive them.
 */
export class CreateHistory1757602100000 implements MigrationInterface {
  name = 'CreateHistory1757602100000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "merge_request_events" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "occurred_at" text NOT NULL,
        "detected_at" text NOT NULL,
        "type" text NOT NULL,
        "status" text NOT NULL DEFAULT ('provisional'),
        "source_event_id" text,
        "connection_id" integer NOT NULL,
        "project_id" integer NOT NULL,
        "mr_iid" integer NOT NULL,
        "mr_title" text NOT NULL,
        "mr_web_url" text NOT NULL,
        "project_alias" text NOT NULL,
        "actor_username" text,
        "actor_name" text,
        "actor_avatar_url" text,
        "old_value" text,
        "new_value" text,
        CONSTRAINT "UQ_mr_events_source" UNIQUE ("connection_id", "source_event_id"),
        CONSTRAINT "FK_mr_events_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_mr_events_occurred_at" ON "merge_request_events" ("occurred_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mr_events_project_occurred_at" ON "merge_request_events" ("project_id", "occurred_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mr_events_type_occurred_at" ON "merge_request_events" ("type", "occurred_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mr_events_project_mr" ON "merge_request_events" ("project_id", "mr_iid")`,
    );
    await queryRunner.query(`
      CREATE TABLE "history_queue" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "project_id" integer NOT NULL,
        "mr_iid" integer NOT NULL,
        "mr_title" text NOT NULL,
        "mr_web_url" text NOT NULL,
        "requested_at" text NOT NULL,
        "attempts" integer NOT NULL DEFAULT (0),
        "next_attempt_at" text,
        CONSTRAINT "UQ_history_queue_project_mr" UNIQUE ("project_id", "mr_iid"),
        CONSTRAINT "FK_history_queue_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_history_queue_requested_at" ON "history_queue" ("requested_at")`,
    );
    await queryRunner.query(`
      CREATE TABLE "history_baselines" (
        "project_id" integer PRIMARY KEY NOT NULL,
        "baselined_at" text NOT NULL,
        CONSTRAINT "FK_history_baselines_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "history_baselines"`);
    await queryRunner.query(`DROP TABLE "history_queue"`);
    await queryRunner.query(`DROP TABLE "merge_request_events"`);
  }
}
