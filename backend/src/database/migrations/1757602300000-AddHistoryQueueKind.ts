import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * US-035 — `history_queue.kind`: `update` (changes to enrich) or
 * `disappeared` (the merge request left the open list: its final state must
 * be looked up).
 */
export class AddHistoryQueueKind1757602300000 implements MigrationInterface {
  name = 'AddHistoryQueueKind1757602300000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "history_queue" ADD COLUMN "kind" text NOT NULL DEFAULT ('update')`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "history_queue" DROP COLUMN "kind"`);
  }
}
