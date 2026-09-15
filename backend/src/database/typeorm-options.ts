import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataSourceOptions } from 'typeorm';

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
  };
}
