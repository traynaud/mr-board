import { INestApplication } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';

/**
 * Builds a fully wired application on an in-memory SQLite database, with the
 * same global prefix, pipes and filters as production.
 * @param customize optional hook to override providers (e.g. the GitLab client).
 * @returns an initialised application; call `app.close()` in `afterAll`.
 */
export async function createTestApp(
  customize?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
): Promise<INestApplication<App>> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (customize) {
    builder = customize(builder);
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>({
    logger: false,
  });
  setupApp(app);
  await app.init();
  return app;
}
