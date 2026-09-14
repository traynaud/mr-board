import { MigrationInterface, QueryRunner } from 'typeorm';

/** US-025 — optional background color for a project's tag in the board (RG-025-01). */
export class AddProjectColor1757601600000 implements MigrationInterface {
  name = 'AddProjectColor1757601600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "projects" ADD COLUMN "color" text NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "color"`);
  }
}
