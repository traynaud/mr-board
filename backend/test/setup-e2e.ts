import { jest } from '@jest/globals';

// Jest's ESM runner does not inject `jest` as an ambient global; expose it
// here (typed by `@types/jest`, not `@jest/globals`'s stricter generics) so
// every e2e spec's bare `jest.fn()` usage keeps working unchanged.
Object.assign(globalThis, { jest });

process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.APP_SECRET = 'test-secret-with-enough-length';
process.env.CORS_ORIGIN = 'http://localhost:4200';
process.env.LOG_LEVEL = 'error';
