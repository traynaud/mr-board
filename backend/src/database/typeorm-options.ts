import { join } from 'node:path';
import { DataSourceOptions } from 'typeorm';

/**
 * Builds the TypeORM options shared by the Nest module and the CLI DataSource.
 * Schema changes always go through versioned migrations (`synchronize: false`).
 * @param dbPath SQLite file path, or `:memory:` for tests.
 */
export function buildTypeOrmOptions(dbPath: string): DataSourceOptions {
  return {
    type: 'better-sqlite3',
    database: dbPath,
    entities: [join(__dirname, '..', 'modules', '**', '*.entity.{ts,js}')],
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    synchronize: false,
    migrationsRun: true,
    logging: false,
  };
}
