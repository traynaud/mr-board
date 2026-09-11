import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

/** Global API prefix. */
export const API_PREFIX = 'api/v1';

/**
 * Applies the global prefix, validation pipe and exception filter.
 * Shared by `main.ts` and the e2e test factory so both run the same stack.
 * @param app the Nest application to configure.
 */
export function setupApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
}
