import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  let service: HealthService;
  const dataSource = { query: jest.fn() } as unknown as jest.Mocked<
    Pick<DataSource, 'query'>
  >;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();
    service = moduleRef.get(HealthService);
  });

  it('should_report_ok_when_database_answers', async () => {
    dataSource.query.mockResolvedValue([{ 1: 1 }]);

    const result = await service.check();

    expect(result.status).toBe('ok');
    expect(result.database).toBe('up');
    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });

  it('should_report_degraded_when_database_fails', async () => {
    dataSource.query.mockRejectedValue(new Error('locked'));

    const result = await service.check();

    expect(result.status).toBe('degraded');
    expect(result.database).toBe('down');
  });
});
