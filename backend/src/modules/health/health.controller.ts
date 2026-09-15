import { Controller, Get } from '@nestjs/common';
import { HealthResponseDto } from './dto/health-response.dto.js';
import { HealthService } from './health.service.js';

/** Liveness endpoint. */
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * `GET /api/v1/health`
   * @returns application and database status.
   */
  @Get()
  getHealth(): Promise<HealthResponseDto> {
    return this.healthService.check();
  }
}
