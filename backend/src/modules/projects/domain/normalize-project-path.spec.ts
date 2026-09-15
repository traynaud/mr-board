import { normalizeProjectPath } from './normalize-project-path.js';

describe('normalizeProjectPath', () => {
  it.each([
    ['equipe/backend-api', 'equipe/backend-api'],
    ['  equipe/backend-api  ', 'equipe/backend-api'],
    ['/equipe/backend-api/', 'equipe/backend-api'],
    ['equipe/sous-groupe/projet', 'equipe/sous-groupe/projet'],
    ['https://gitlab.exemple.fr/equipe/backend-api', 'equipe/backend-api'],
    ['https://gitlab.exemple.fr/equipe/backend-api/', 'equipe/backend-api'],
    [
      'https://gitlab.exemple.fr/equipe/front-web/-/merge_requests',
      'equipe/front-web',
    ],
    [
      'https://gitlab.exemple.fr/equipe/front-web/-/tree/main',
      'equipe/front-web',
    ],
    ['HTTPS://gitlab.exemple.fr/equipe/front-web', 'equipe/front-web'],
  ])('should_normalize %s', (input, expected) => {
    expect(normalizeProjectPath(input)).toBe(expected);
  });

  it.each([
    '',
    '   ',
    '/',
    '///',
    'https://gitlab.exemple.fr',
    'https://gitlab.exemple.fr/',
  ])('should_reject %s', (input) => {
    expect(normalizeProjectPath(input)).toBeNull();
  });
});
