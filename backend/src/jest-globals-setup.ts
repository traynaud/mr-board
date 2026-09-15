import { jest } from '@jest/globals';

/**
 * Jest's ESM runner does not inject `jest` as an ambient global the way it
 * does under CommonJS. Exposing it here (typed by `@types/jest`'s ambient
 * declaration, not `@jest/globals`'s stricter generics) keeps every spec
 * file's bare `jest.fn()`/`jest.mock()` usage working unchanged.
 */
Object.assign(globalThis, { jest });
