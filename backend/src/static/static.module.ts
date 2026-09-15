import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { API_PREFIX } from '../app.setup.js';
import { APP_CONFIG, AppConfig } from '../config/configuration.js';

/**
 * Serves the built frontend (Angular) from `STATIC_DIR` on the same origin as
 * the API, so a single process/container can host the whole application.
 * Unknown paths fall back to `index.html` (SPA routing); `/api/*` is excluded.
 * Nothing is registered when `STATIC_DIR` is not set (local dev with `ng serve`).
 */
@Module({
  imports: [
    ServeStaticModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const { staticDir } = config.getOrThrow<AppConfig>(APP_CONFIG);
        return staticDir ? [buildStaticOptions(staticDir)] : [];
      },
    }),
  ],
})
export class StaticModule {}

/**
 * Builds the serve-static options for a given frontend directory.
 * @param rootPath absolute or cwd-relative directory holding `index.html`.
 */
export function buildStaticOptions(rootPath: string) {
  return {
    rootPath,
    exclude: [`/${API_PREFIX}/{*path}`],
    serveStaticOptions: { index: 'index.html', maxAge: '1h' },
  };
}
