import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataSourceOptions } from 'typeorm';
import { SQL_FOLD_FUNCTION } from '../modules/history/domain/history-filter.js';
import { normalizeSearchText } from '../modules/merge-requests/domain/search-merge-requests.js';

const currentDir = dirname(fileURLToPath(import.meta.url));

/**
 * Builds the TypeORM options shared by the Nest module and the CLI DataSource.
 * Schema changes always go through versioned migrations (`synchronize: false`).
 * @param dbPath SQLite file path, or `:memory:` for tests.
 */
export function buildTypeOrmOptions(dbPath: string): DataSourceOptions {
  return {
    type: 'better-sqlite3',
    database: dbPath,
    entities: [join(currentDir, '..', 'modules', '**', '*.entity.{ts,js}')],
    migrations: [join(currentDir, 'migrations', '*.{ts,js}')],
    synchronize: false,
    migrationsRun: true,
    logging: false,
    // `mrb_fold` folds case and accents in SQL for the history search (US-038, RG-038-05).
    prepareDatabase: (db: SqliteConnection) => registerSqlFunctions(db),
  };
}

/** Minimal view of the `better-sqlite3` connection used to register SQL functions. */
interface SqliteConnection {
  function(
    name: string,
    options: { deterministic: boolean },
    implementation: (value: unknown) => unknown,
  ): unknown;
}

/** Registers the application SQL functions on a fresh SQLite connection. */
function registerSqlFunctions(db: SqliteConnection): void {
  db.function(SQL_FOLD_FUNCTION, { deterministic: true }, (value) =>
    typeof value === 'string' ? normalizeSearchText(value) : value,
  );
}
