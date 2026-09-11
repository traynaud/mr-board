import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_CONFIG, AppConfig } from '../config/configuration';
import { buildTypeOrmOptions } from './typeorm-options';

/**
 * Ensures the directory holding the SQLite file exists.
 * No-op for the in-memory database.
 * @param dbPath configured database path.
 */
export function ensureDatabaseDirectory(dbPath: string): void {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
}

/** Registers the SQLite connection and runs pending migrations at startup. */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const { dbPath } = config.getOrThrow<AppConfig>(APP_CONFIG);
        ensureDatabaseDirectory(dbPath);
        return buildTypeOrmOptions(dbPath);
      },
    }),
  ],
})
export class DatabaseModule {}
