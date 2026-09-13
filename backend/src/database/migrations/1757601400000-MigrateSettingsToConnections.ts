import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * US-019, RG-019-06 — migrates the single-instance GitLab configuration
 * (`settings.gitlab_url`/`gitlab_token_encrypted`/`me_username`) into a
 * `connections` row, rattaches every existing repo/user to it, and gives
 * `projects`/`users` a text remote id (`remote_project_id`/`remote_user_id`)
 * instead of a GitLab-only numeric one (RG-019-05). On a fresh install
 * (no token, no repo) no connection is created. SQLite has no `ALTER
 * COLUMN`/`ADD CONSTRAINT`: every touched table is recreated, following the
 * same pattern as `AllowNullDiffStats1757600400000`.
 */
export class MigrateSettingsToConnections1757601400000 implements MigrationInterface {
  name = 'MigrateSettingsToConnections1757601400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const connectionId = await this.migrateSettingsIntoAConnection(queryRunner);
    await this.rebuildProjects(queryRunner, connectionId);
    await this.rebuildUsers(queryRunner, connectionId);
    await this.rebuildSettings(queryRunner);
  }

  /**
   * @returns the id of the connection created from the legacy GitLab
   * configuration, or `null` on a fresh install (RG-019-06).
   */
  private async migrateSettingsIntoAConnection(
    queryRunner: QueryRunner,
  ): Promise<number | null> {
    const [settings] = (await queryRunner.query(
      `SELECT "gitlab_url", "gitlab_token_encrypted", "me_username" FROM "settings" WHERE "id" = 1`,
    )) as {
      gitlab_url: string;
      gitlab_token_encrypted: string | null;
      me_username: string | null;
    }[];
    const [{ count }] = (await queryRunner.query(
      `SELECT COUNT(*) as count FROM "projects"`,
    )) as { count: number }[];
    if (!settings || (!settings.gitlab_token_encrypted && count === 0)) {
      return null;
    }
    const now = new Date().toISOString();
    await queryRunner.query(
      `INSERT INTO "connections" ("type", "name", "url", "token_encrypted", "me_username", "created_at", "updated_at")
       VALUES ('gitlab', 'GitLab', ?, ?, ?, ?, ?)`,
      [
        settings.gitlab_url,
        settings.gitlab_token_encrypted,
        settings.me_username,
        now,
        now,
      ],
    );
    const [{ id }] = (await queryRunner.query(
      `SELECT last_insert_rowid() as id`,
    )) as { id: number }[];
    return id;
  }

  private async rebuildProjects(
    queryRunner: QueryRunner,
    connectionId: number | null,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "projects_new" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "connection_id" integer NOT NULL,
        "remote_project_id" text NOT NULL,
        "path_with_namespace" text NOT NULL COLLATE NOCASE,
        "alias" text NOT NULL COLLATE NOCASE,
        "web_url" text NOT NULL,
        "enabled" boolean NOT NULL DEFAULT (1),
        "created_at" text NOT NULL,
        CONSTRAINT "UQ_projects_connection_remote_id" UNIQUE ("connection_id", "remote_project_id"),
        CONSTRAINT "UQ_projects_connection_path" UNIQUE ("connection_id", "path_with_namespace"),
        CONSTRAINT "UQ_projects_alias" UNIQUE ("alias"),
        CONSTRAINT "FK_projects_connection" FOREIGN KEY ("connection_id") REFERENCES "connections" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `INSERT INTO "projects_new" ("id", "connection_id", "remote_project_id", "path_with_namespace", "alias", "web_url", "enabled", "created_at")
       SELECT "id", ?, CAST("gitlab_project_id" AS text), "path_with_namespace", "alias", "web_url", "enabled", "created_at"
       FROM "projects"`,
      [connectionId],
    );
    await queryRunner.query(`DROP TABLE "projects"`);
    await queryRunner.query(`ALTER TABLE "projects_new" RENAME TO "projects"`);
  }

  private async rebuildUsers(
    queryRunner: QueryRunner,
    connectionId: number | null,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users_new" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "connection_id" integer NOT NULL,
        "remote_user_id" text NOT NULL,
        "username" text NOT NULL,
        "name" text NOT NULL,
        "avatar_url" text NULL,
        "web_url" text NOT NULL,
        CONSTRAINT "UQ_users_connection_remote_id" UNIQUE ("connection_id", "remote_user_id"),
        CONSTRAINT "FK_users_connection" FOREIGN KEY ("connection_id") REFERENCES "connections" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `INSERT INTO "users_new" ("id", "connection_id", "remote_user_id", "username", "name", "avatar_url", "web_url")
       SELECT "id", ?, CAST("gitlab_user_id" AS text), "username", "name", "avatar_url", "web_url"
       FROM "users"`,
      [connectionId],
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`ALTER TABLE "users_new" RENAME TO "users"`);
  }

  private async rebuildSettings(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "settings_new" (
        "id" integer PRIMARY KEY NOT NULL CHECK ("id" = 1),
        "me_email" text NULL,
        "refresh_interval_min" integer NOT NULL DEFAULT (5),
        "pause_when_hidden" boolean NOT NULL DEFAULT (1),
        "easy_files" integer NOT NULL DEFAULT (5),
        "easy_lines" integer NOT NULL DEFAULT (100),
        "hard_files" integer NOT NULL DEFAULT (20),
        "hard_lines" integer NOT NULL DEFAULT (800),
        "ready_green_days" integer NOT NULL DEFAULT (1),
        "ready_orange_days" integer NOT NULL DEFAULT (3),
        "workdays_only" boolean NOT NULL DEFAULT (0),
        "open_in_new_tab" boolean NOT NULL DEFAULT (0),
        "ignored_labels" text NOT NULL DEFAULT ('[]'),
        "notify_assigned" boolean NOT NULL DEFAULT (0),
        "tab_badge" boolean NOT NULL DEFAULT (0),
        "theme" text NOT NULL DEFAULT ('system'),
        "highlight_me" boolean NOT NULL DEFAULT (1),
        "language" text NOT NULL DEFAULT ('fr'),
        "updated_at" text NOT NULL
      )
    `);
    await queryRunner.query(`
      INSERT INTO "settings_new" (
        "id", "me_email", "refresh_interval_min", "pause_when_hidden", "easy_files", "easy_lines",
        "hard_files", "hard_lines", "ready_green_days", "ready_orange_days", "workdays_only",
        "open_in_new_tab", "ignored_labels", "notify_assigned", "tab_badge", "theme", "highlight_me",
        "language", "updated_at"
      )
      SELECT
        "id", "me_email", "refresh_interval_min", "pause_when_hidden", "easy_files", "easy_lines",
        "hard_files", "hard_lines", "ready_green_days", "ready_orange_days", "workdays_only",
        "open_in_new_tab", "ignored_labels", "notify_assigned", "tab_badge", "theme", "highlight_me",
        "language", "updated_at"
      FROM "settings"
    `);
    await queryRunner.query(`DROP TABLE "settings"`);
    await queryRunner.query(`ALTER TABLE "settings_new" RENAME TO "settings"`);
  }

  down(): Promise<void> {
    throw new Error(
      'MigrateSettingsToConnections1757601400000 is not reversible: the legacy single-connection GitLab configuration is not recoverable from the connections table alone.',
    );
  }
}
