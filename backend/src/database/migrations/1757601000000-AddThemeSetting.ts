import { MigrationInterface, QueryRunner } from 'typeorm';

/** US-018 — Theme preference setting (`system` / `light` / `dark`). */
export class AddThemeSetting1757601000000 implements MigrationInterface {
  name = 'AddThemeSetting1757601000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "theme" text NOT NULL DEFAULT ('system')`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "theme"`);
  }
}
