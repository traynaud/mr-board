import { normalizeGithubProjectPath } from './normalize-github-project-path.js';

describe('normalizeGithubProjectPath', () => {
  it('should_accept_a_bare_path', () => {
    expect(normalizeGithubProjectPath('equipe/front-web')).toBe(
      'equipe/front-web',
    );
  });

  it('should_extract_the_path_from_a_full_url', () => {
    expect(
      normalizeGithubProjectPath('https://github.com/Equipe/Front-Web'),
    ).toBe('Equipe/Front-Web');
  });

  it('should_strip_a_trailing_pulls_suffix', () => {
    expect(
      normalizeGithubProjectPath('https://github.com/Equipe/Front-Web/pulls'),
    ).toBe('Equipe/Front-Web');
  });

  it('should_strip_a_trailing_pulls_suffix_with_a_pr_number', () => {
    expect(
      normalizeGithubProjectPath(
        'https://github.com/Equipe/Front-Web/pulls/42',
      ),
    ).toBe('Equipe/Front-Web');
  });

  it('should_strip_a_trailing_git_suffix', () => {
    expect(
      normalizeGithubProjectPath('https://github.com/Equipe/Front-Web.git'),
    ).toBe('Equipe/Front-Web');
  });

  it('should_strip_a_trailing_git_suffix_on_a_bare_path', () => {
    expect(normalizeGithubProjectPath('equipe/front-web.git')).toBe(
      'equipe/front-web',
    );
  });

  it('should_trim_leading_and_trailing_slashes', () => {
    expect(normalizeGithubProjectPath('/equipe/front-web/')).toBe(
      'equipe/front-web',
    );
  });

  it('should_return_null_for_an_empty_input', () => {
    expect(normalizeGithubProjectPath('')).toBeNull();
    expect(normalizeGithubProjectPath('   ')).toBeNull();
  });

  it('should_return_null_when_the_url_is_malformed', () => {
    expect(normalizeGithubProjectPath('https://')).toBeNull();
  });

  it('should_not_validate_the_segment_count', () => {
    expect(normalizeGithubProjectPath('equipe/sous/front-web')).toBe(
      'equipe/sous/front-web',
    );
    expect(normalizeGithubProjectPath('equipe')).toBe('equipe');
  });
});
