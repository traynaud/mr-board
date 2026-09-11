import * as Joi from 'joi';

/**
 * Joi schema validating environment variables at startup.
 * The application refuses to boot when a required variable is missing.
 */
export const validationSchema = Joi.object({
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  DB_PATH: Joi.string().default('./data/mr-board.sqlite'),
  APP_SECRET: Joi.string().min(16).required(),
  CORS_ORIGIN: Joi.string().uri().default('http://localhost:4200'),
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'log', 'debug', 'verbose')
    .default('log'),
});
