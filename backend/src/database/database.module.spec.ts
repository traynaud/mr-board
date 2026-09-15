import { jest as jestGlobals } from '@jest/globals';

const actualFs = await import('node:fs');
const mkdirSync = jest.fn();
jestGlobals.unstable_mockModule('node:fs', () => ({ ...actualFs, mkdirSync }));

const { ensureDatabaseDirectory } = await import('./database.module.js');
const { buildTypeOrmOptions } = await import('./typeorm-options.js');

describe('ensureDatabaseDirectory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should_create_parent_directory_for_file_database', () => {
    ensureDatabaseDirectory('./data/mr-board.sqlite');

    expect(mkdirSync).toHaveBeenCalledWith('./data', { recursive: true });
  });

  it('should_skip_in_memory_database', () => {
    ensureDatabaseDirectory(':memory:');

    expect(mkdirSync).not.toHaveBeenCalled();
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
