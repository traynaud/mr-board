import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * US-034 — `history_queue.since`: start of the window to re-read on the forge
 * (oldest pending trigger). Nullable: entries queued by US-033 fall back to
 * `requested_at`.
 */
export class AddHistoryQueueSince1757602200000 implements MigrationInterface {
  name = 'AddHistoryQueueSince1757602200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "history_queue" ADD COLUMN "since" text`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "history_queue" DROP COLUMN "since"`);
  }
}
