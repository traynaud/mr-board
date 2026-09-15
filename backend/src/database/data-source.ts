import 'dotenv/config';
import { DataSource } from 'typeorm';
import { buildTypeOrmOptions } from './typeorm-options.js';

/**
 * DataSource used by the TypeORM CLI (`npm run migration:*`).
 * Reads `DB_PATH` from `.env`, falling back to the default local file.
 */
export default new DataSource(
  buildTypeOrmOptions(process.env.DB_PATH ?? './data/mr-board.sqlite'),
);
