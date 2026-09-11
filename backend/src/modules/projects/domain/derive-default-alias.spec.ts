import { deriveDefaultAlias } from './derive-default-alias';

describe('deriveDefaultAlias', () => {
  it.each([
    ['equipe/backend-api', 'backend-api'],
    ['equipe/sous-groupe/projet', 'projet'],
    ['backend-api', 'backend-api'],
  ])('should_derive %s as %s', (path, expected) => {
    expect(deriveDefaultAlias(path)).toBe(expected);
  });
});
