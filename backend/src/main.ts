import { LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { setupApp } from './app.setup';
import { APP_CONFIG, AppConfig } from './config/configuration';
import { buildHelmetOptions } from './config/helmet-options';

const LOG_LEVELS: readonly LogLevel[] = [
  'error',
  'warn',
  'log',
  'debug',
  'verbose',
];

/** Boots the HTTP server. */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const { port, corsOrigin, logLevel, staticDir } = app
    .get(ConfigService)
    .getOrThrow<AppConfig>(APP_CONFIG);
  const maxLevel = LOG_LEVELS.indexOf(logLevel as LogLevel);
  app.useLogger(LOG_LEVELS.slice(0, maxLevel + 1));
  app.use(helmet(buildHelmetOptions(staticDir)));
  app.enableCors({ origin: corsOrigin });
  setupApp(app);
  app.enableShutdownHooks();
  await app.listen(port);
}

void bootstrap();
