import { APP_CONFIG, configuration } from './configuration.js';
import { validationSchema } from './validation.schema.js';

describe('configuration', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterAll(() => {
    process.env = env;
  });

  it('should_use_defaults_when_env_is_empty', () => {
    delete process.env.PORT;
    delete process.env.DB_PATH;
    delete process.env.CORS_ORIGIN;
    delete process.env.LOG_LEVEL;

    const config = configuration()[APP_CONFIG];

    expect(config.port).toBe(3000);
    expect(config.dbPath).toBe('./data/mr-board.sqlite');
    expect(config.corsOrigin).toBe('http://localhost:4200');
    expect(config.logLevel).toBe('log');
  });

  it('should_read_env_values', () => {
    process.env.PORT = '4000';
    process.env.DB_PATH = ':memory:';
    process.env.APP_SECRET = 'a-very-long-secret-value';

    const config = configuration()[APP_CONFIG];

    expect(config.port).toBe(4000);
    expect(config.dbPath).toBe(':memory:');
    expect(config.appSecret).toBe('a-very-long-secret-value');
  });
});

describe('validationSchema', () => {
  it('should_require_app_secret', () => {
    const { error } = validationSchema.validate({});

    expect(error?.message).toContain('APP_SECRET');
  });

  it('should_reject_short_app_secret', () => {
    const { error } = validationSchema.validate({ APP_SECRET: 'short' });

    expect(error).toBeDefined();
  });

  it('should_reject_unknown_log_level', () => {
    const { error } = validationSchema.validate({
      APP_SECRET: 'a-very-long-secret-value',
      LOG_LEVEL: 'trace',
    });

    expect(error?.message).toContain('LOG_LEVEL');
  });

  it('should_apply_defaults', () => {
    const { value, error } = validationSchema.validate({
      APP_SECRET: 'a-very-long-secret-value',
    }) as { value: Record<string, unknown>; error?: Error };

    expect(error).toBeUndefined();
    expect(value.PORT).toBe(3000);
    expect(value.CORS_ORIGIN).toBe('http://localhost:4200');
  });
});
