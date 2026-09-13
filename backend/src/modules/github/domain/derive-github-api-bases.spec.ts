import { deriveGithubApiBases } from './derive-github-api-bases';

describe('deriveGithubApiBases', () => {
  it('should_use_the_dedicated_api_host_for_github_com', () => {
    expect(deriveGithubApiBases('https://github.com')).toEqual({
      rest: 'https://api.github.com',
      graphql: 'https://api.github.com/graphql',
    });
  });

  it('should_derive_api_v3_and_graphql_paths_for_a_ghes_origin', () => {
    expect(deriveGithubApiBases('https://github.exemple.fr')).toEqual({
      rest: 'https://github.exemple.fr/api/v3',
      graphql: 'https://github.exemple.fr/api/graphql',
    });
  });
});
