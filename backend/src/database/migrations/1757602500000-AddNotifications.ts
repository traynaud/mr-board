import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * US-039/040/041 — notifications of the history: `dismissed_at` marks an event
 * as seen, `mr_involved_usernames` freezes who the merge request concerned at
 * detection time (also carried by the queue), and the notification
 * preferences live in `settings`.
 */
export class AddNotifications1757602500000 implements MigrationInterface {
  name = 'AddNotifications1757602500000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "merge_request_events" ADD COLUMN "dismissed_at" text NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "merge_request_events" ADD COLUMN "mr_involved_usernames" text NULL`,
    );
    // RG-039-02: the events that exist at deployment time are already seen.
    await queryRunner.query(
      `UPDATE "merge_request_events" SET "dismissed_at" = ?`,
      [new Date().toISOString()],
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_merge_request_events_dismissed" ON "merge_request_events" ("dismissed_at", "occurred_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "history_queue" ADD COLUMN "mr_involved_usernames" text NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "notif_disabled_types" text NOT NULL DEFAULT ('[]')`,
    );
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "notif_only_mine" boolean NOT NULL DEFAULT (0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "notif_exclude_own" boolean NOT NULL DEFAULT (0)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "notif_exclude_own"`,
    );
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "notif_only_mine"`,
    );
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "notif_disabled_types"`,
    );
    await queryRunner.query(
      `ALTER TABLE "history_queue" DROP COLUMN "mr_involved_usernames"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_merge_request_events_dismissed"`);
    await queryRunner.query(
      `ALTER TABLE "merge_request_events" DROP COLUMN "mr_involved_usernames"`,
    );
    await queryRunner.query(
      `ALTER TABLE "merge_request_events" DROP COLUMN "dismissed_at"`,
    );
  }
}
