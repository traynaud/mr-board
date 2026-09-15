import { Test } from '@nestjs/testing';
import { HealthResponseDto } from './dto/health-response.dto.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

describe('HealthController', () => {
  let controller: HealthController;
  const healthService = { check: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: healthService }],
    }).compile();
    controller = moduleRef.get(HealthController);
  });

  it('should_delegate_to_service', async () => {
    const report: HealthResponseDto = {
      status: 'ok',
      database: 'up',
      timestamp: '2026-09-11T10:00:00.000Z',
    };
    healthService.check.mockResolvedValue(report);

    await expect(controller.getHealth()).resolves.toEqual(report);
    expect(healthService.check).toHaveBeenCalledTimes(1);
  });
});
