import { MigrationInterface, QueryRunner } from 'typeorm';

/** US-002 — "Me" identity used by "Mes MRs" and role matching. */
export class AddMeIdentity1757600100000 implements MigrationInterface {
  name = 'AddMeIdentity1757600100000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "me_username" text NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "me_email" text NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "me_username"`);
    await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "me_email"`);
  }
}
