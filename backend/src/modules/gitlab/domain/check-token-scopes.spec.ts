import { hasRequiredScope } from './check-token-scopes.js';

describe('hasRequiredScope', () => {
  it.each([
    [['read_api'], true],
    [['api'], true],
    [['read_user', 'read_api'], true],
    [['read_user'], false],
    [['read_repository', 'write_repository'], false],
    [[], false],
  ])('should_evaluate %j as %s', (scopes, expected) => {
    expect(hasRequiredScope(scopes)).toBe(expected);
  });
});
