import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { HealthResponseDto } from './dto/health-response.dto.js';

/** Checks the liveness of the application and its dependencies. */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Runs a trivial query against SQLite to verify the connection.
   * @returns the health report; never throws.
   */
  async check(): Promise<HealthResponseDto> {
    let database: HealthResponseDto['database'] = 'up';
    try {
      await this.dataSource.query('SELECT 1');
    } catch (error) {
      this.logger.warn(`Database check failed: ${String(error)}`);
      database = 'down';
    }
    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      timestamp: new Date().toISOString(),
    };
  }
}
