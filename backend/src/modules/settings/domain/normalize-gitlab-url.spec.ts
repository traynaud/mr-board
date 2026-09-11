import { normalizeGitlabUrl } from './normalize-gitlab-url';

describe('normalizeGitlabUrl', () => {
  it.each([
    ['https://gitlab.exemple.fr', 'https://gitlab.exemple.fr'],
    ['https://gitlab.exemple.fr/', 'https://gitlab.exemple.fr'],
    ['  https://gitlab.exemple.fr/api/v4/  ', 'https://gitlab.exemple.fr'],
    ['HTTPS://GitLab.Exemple.fr', 'https://gitlab.exemple.fr'],
    ['http://localhost:8929/groupe/projet', 'http://localhost:8929'],
    ['https://gitlab.com:443/', 'https://gitlab.com'],
  ])('should_normalize %s', (input, expected) => {
    expect(normalizeGitlabUrl(input)).toBe(expected);
  });

  it.each([
    ['gitlab.exemple.fr'],
    ['ftp://gitlab.exemple.fr'],
    ['https://'],
    [''],
    ['   '],
  ])('should_reject %s', (input) => {
    expect(normalizeGitlabUrl(input)).toBeNull();
  });
});
