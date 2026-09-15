import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app.js';

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
    // Nest 12's Express adapter only mounts the JSON not-found handler under
    // the global prefix (multi-app-per-adapter support); a path outside
    // `/api/v1` never reaches Nest and gets Express's own raw 404 page.
    const res = await request(app.getHttpServer()).get('/health');

    expect(res.status).toBe(404);
  });
});
