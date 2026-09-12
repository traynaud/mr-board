/**
 * Typed application configuration built from environment variables.
 * Validated beforehand by `validationSchema` (see validation.schema.ts).
 */
export interface AppConfig {
  port: number;
  dbPath: string;
  appSecret: string;
  corsOrigin: string;
  logLevel: string;
  /** Directory of the built frontend to serve on `/` (undefined = API only). */
  staticDir?: string;
}

/** Configuration key used with `ConfigService.get<AppConfig>(APP_CONFIG)`. */
export const APP_CONFIG = 'app';

/**
 * Loads the application configuration from `process.env`.
 * @returns the configuration namespaced under `app`.
 */
export const configuration = (): { [APP_CONFIG]: AppConfig } => ({
  [APP_CONFIG]: {
    port: Number(process.env.PORT ?? 3000),
    dbPath: process.env.DB_PATH ?? './data/mr-board.sqlite',
    appSecret: process.env.APP_SECRET ?? '',
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:4200',
    logLevel: process.env.LOG_LEVEL ?? 'log',
    staticDir: process.env.STATIC_DIR || undefined,
  },
});
