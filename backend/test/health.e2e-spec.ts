import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health should_return_ok_with_database_up', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'ok',
      database: 'up',
      timestamp: expect.any(String) as string,
    });
  });

  it('GET /health should_be_404_outside_prefix', async () => {
    const res = await request(app.getHttpServer()).get('/health');

    expect(res.status).toBe(404);
    expect(res.body).toEqual(
      expect.objectContaining({
        statusCode: 404,
        path: '/health',
        timestamp: expect.any(String) as string,
      }),
    );
  });
});
