import * as fs from 'node:fs';
import { ensureDatabaseDirectory } from './database.module';
import { buildTypeOrmOptions } from './typeorm-options';

jest.mock('node:fs', () => ({ mkdirSync: jest.fn() }));

describe('ensureDatabaseDirectory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should_create_parent_directory_for_file_database', () => {
    ensureDatabaseDirectory('./data/mr-board.sqlite');

    expect(fs.mkdirSync).toHaveBeenCalledWith('./data', { recursive: true });
  });

  it('should_skip_in_memory_database', () => {
    ensureDatabaseDirectory(':memory:');

    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });
});

describe('buildTypeOrmOptions', () => {
  it('should_disable_synchronize_and_run_migrations', () => {
    const options = buildTypeOrmOptions(':memory:');

    expect(options.type).toBe('better-sqlite3');
    expect(options.synchronize).toBe(false);
    expect(options.migrationsRun).toBe(true);
    expect(options).toEqual(expect.objectContaining({ database: ':memory:' }));
  });
});
