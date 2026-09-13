import { MigrationInterface, QueryRunner } from 'typeorm';

/** US-022 — UI language preference (`fr` / `en`). */
export class AddLanguageSetting1757601200000 implements MigrationInterface {
  name = 'AddLanguageSetting1757601200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "language" text NOT NULL DEFAULT ('fr')`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "language"`);
  }
}
