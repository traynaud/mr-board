import { parseImportFile, summarizeImport } from './config-transfer';

describe('parseImportFile', () => {
  const validText = JSON.stringify({
    version: 1,
    settings: { gitlabUrl: 'https://gitlab.com' },
    projects: [{ pathWithNamespace: 'equipe/backend-api', alias: 'api' }],
  });

  it('should_parse_a_valid_config', () => {
    const result = parseImportFile(validText);

    expect(result).toEqual({
      version: 1,
      settings: { gitlabUrl: 'https://gitlab.com' },
      projects: [{ pathWithNamespace: 'equipe/backend-api', alias: 'api' }],
    });
  });

  it('should_return_null_for_invalid_json', () => {
    expect(parseImportFile('not json')).toBeNull();
  });

  it('should_return_null_when_version_is_missing', () => {
    expect(
      parseImportFile(JSON.stringify({ settings: {}, projects: [] })),
    ).toBeNull();
  });

  it('should_return_null_when_settings_is_not_an_object', () => {
    expect(
      parseImportFile(JSON.stringify({ version: 1, settings: 'nope', projects: [] })),
    ).toBeNull();
  });

  it('should_return_null_when_projects_is_not_an_array', () => {
    expect(
      parseImportFile(JSON.stringify({ version: 1, settings: {}, projects: {} })),
    ).toBeNull();
  });

  it('should_return_null_for_a_json_array_at_the_top_level', () => {
    expect(parseImportFile('[]')).toBeNull();
  });

  it('should_return_null_for_null', () => {
    expect(parseImportFile('null')).toBeNull();
  });
});

describe('summarizeImport', () => {
  it('should_count_settings_total_repos_and_new_repos', () => {
    const config = {
      version: 1,
      settings: { gitlabUrl: 'https://gitlab.com', easyFiles: 10 },
      projects: [
        { pathWithNamespace: 'equipe/backend-api', alias: 'api' },
        { pathWithNamespace: 'equipe/front-web', alias: 'web' },
      ],
    };

    const summary = summarizeImport(config, ['equipe/backend-api']);

    expect(summary).toEqual({ settingsCount: 2, totalRepos: 2, newRepos: 1 });
  });

  it('should_match_current_paths_case_insensitively', () => {
    const config = {
      version: 1,
      settings: { gitlabUrl: 'https://gitlab.com' },
      projects: [{ pathWithNamespace: 'Equipe/Backend-API', alias: 'api' }],
    };

    const summary = summarizeImport(config, ['equipe/backend-api']);

    expect(summary.newRepos).toBe(0);
  });

  it('should_count_every_repo_as_new_when_none_are_configured', () => {
    const config = {
      version: 1,
      settings: { gitlabUrl: 'https://gitlab.com' },
      projects: [{ pathWithNamespace: 'equipe/backend-api', alias: 'api' }],
    };

    const summary = summarizeImport(config, []);

    expect(summary.newRepos).toBe(1);
  });
});
