import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * US-017 — Merge status (mergeability) raw fields on `merge_requests`. All
 * nullable, no backfill (RG-017-11): a merge request already in base reports
 * `state: 'unknown'` until the next synchronisation refreshes these columns.
 */
export class AddMergeStatusFields1757600900000 implements MigrationInterface {
  name = 'AddMergeStatusFields1757600900000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "merge_requests" ADD COLUMN "detailed_merge_status" text NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "merge_requests" ADD COLUMN "conflicts" boolean NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "merge_requests" ADD COLUMN "head_pipeline_status" text NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "merge_requests" ADD COLUMN "approvals_required" integer NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "merge_requests" ADD COLUMN "approvals_left" integer NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "merge_requests" ADD COLUMN "resolvable_discussions_count" integer NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "merge_requests" ADD COLUMN "resolved_discussions_count" integer NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "merge_requests" DROP COLUMN "resolved_discussions_count"`,
    );
    await queryRunner.query(
      `ALTER TABLE "merge_requests" DROP COLUMN "resolvable_discussions_count"`,
    );
    await queryRunner.query(
      `ALTER TABLE "merge_requests" DROP COLUMN "approvals_left"`,
    );
    await queryRunner.query(
      `ALTER TABLE "merge_requests" DROP COLUMN "approvals_required"`,
    );
    await queryRunner.query(
      `ALTER TABLE "merge_requests" DROP COLUMN "head_pipeline_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "merge_requests" DROP COLUMN "conflicts"`,
    );
    await queryRunner.query(
      `ALTER TABLE "merge_requests" DROP COLUMN "detailed_merge_status"`,
    );
  }
}
