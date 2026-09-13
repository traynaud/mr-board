import { MigrationInterface, QueryRunner } from 'typeorm';
import { computeGitlabMergeStatus } from '../../modules/gitlab/mappers/compute-gitlab-merge-status';

/**
 * US-019, RG-019-21 — `mergeStatus` becomes a value computed once by the
 * forge's own mapper (here, GitLab's) instead of 7 raw signals recomputed on
 * every read (see `archi.md` §Décisions d'architecture). Replaces
 * `detailed_merge_status`/`conflicts`/`head_pipeline_status`/
 * `approvals_required`/`approvals_left`/`resolvable_discussions_count`/
 * `resolved_discussions_count` with `merge_status_state`/
 * `merge_status_reasons` (JSON), backfilled from the existing raw columns —
 * unlike RG-017-11's original "no backfill" rule, this migration can and
 * does backfill, since it merely re-expresses data already present. Also
 * renames `gitlab_mr_id` to `remote_id` (text, RG-019-05).
 */
export class AddMergeStatusColumns1757601500000 implements MigrationInterface {
  name = 'AddMergeStatusColumns1757601500000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT "id", "detailed_merge_status", "conflicts", "head_pipeline_status",
              "approvals_left", "resolvable_discussions_count", "resolved_discussions_count"
       FROM "merge_requests"`,
    )) as {
      id: number;
      detailed_merge_status: string | null;
      conflicts: 0 | 1 | null;
      head_pipeline_status: string | null;
      approvals_left: number | null;
      resolvable_discussions_count: number | null;
      resolved_discussions_count: number | null;
    }[];
    const statusById = new Map(
      rows.map((row) => [
        row.id,
        computeGitlabMergeStatus({
          detailedMergeStatus: row.detailed_merge_status,
          conflicts: row.conflicts === null ? null : row.conflicts === 1,
          headPipelineStatus: row.head_pipeline_status,
          approvalsLeft: row.approvals_left,
          resolvableDiscussionsCount: row.resolvable_discussions_count,
          resolvedDiscussionsCount: row.resolved_discussions_count,
        }),
      ]),
    );

    await queryRunner.query(`
      CREATE TABLE "merge_requests_new" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "remote_id" text NOT NULL,
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
        "merge_status_state" text NOT NULL DEFAULT ('unknown'),
        "merge_status_reasons" text NOT NULL DEFAULT ('[]'),
        CONSTRAINT "UQ_merge_requests_project_iid" UNIQUE ("project_id", "iid"),
        CONSTRAINT "FK_merge_requests_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_merge_requests_author" FOREIGN KEY ("author_id") REFERENCES "users" ("id")
      )
    `);
    await queryRunner.query(`
      INSERT INTO "merge_requests_new" (
        "id", "remote_id", "iid", "project_id", "title", "web_url", "draft",
        "author_id", "approved", "comments_count", "changed_files", "additions",
        "deletions", "labels", "created_at_gitlab", "ready_at", "updated_at_gitlab", "synced_at"
      )
      SELECT
        "id", CAST("gitlab_mr_id" AS text), "iid", "project_id", "title", "web_url", "draft",
        "author_id", "approved", "comments_count", "changed_files", "additions",
        "deletions", "labels", "created_at_gitlab", "ready_at", "updated_at_gitlab", "synced_at"
      FROM "merge_requests"
    `);
    for (const [id, status] of statusById) {
      await queryRunner.query(
        `UPDATE "merge_requests_new" SET "merge_status_state" = ?, "merge_status_reasons" = ? WHERE "id" = ?`,
        [status.state, JSON.stringify(status.reasons), id],
      );
    }
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

  down(): Promise<void> {
    throw new Error(
      'AddMergeStatusColumns1757601500000 is not reversible: the original per-forge raw mergeability signals are not recoverable from the computed mergeStatus alone.',
    );
  }
}
