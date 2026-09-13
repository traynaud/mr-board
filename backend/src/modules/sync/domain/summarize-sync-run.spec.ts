import { summarizeSyncRun } from './summarize-sync-run';

describe('summarizeSyncRun', () => {
  it('should_return_success_when_no_project_failed', () => {
    const result = summarizeSyncRun([
      { projectAlias: 'api', success: true, mrCount: 5 },
      { projectAlias: 'web', success: true, mrCount: 2 },
    ]);
    expect(result).toEqual({
      status: 'success',
      mrCount: 7,
      errorMessage: null,
    });
  });

  it('should_return_success_with_zero_mr_count_when_no_project_to_sync', () => {
    expect(summarizeSyncRun([])).toEqual({
      status: 'success',
      mrCount: 0,
      errorMessage: null,
    });
  });

  it('should_return_partial_when_at_least_one_project_succeeded_and_one_failed', () => {
    const result = summarizeSyncRun([
      { projectAlias: 'api', success: true, mrCount: 5 },
      {
        projectAlias: 'infra',
        success: false,
        errorMessage: 'GitLab is unavailable',
      },
    ]);
    expect(result.status).toBe('partial');
    expect(result.mrCount).toBe(5);
    expect(result.errorMessage).toContain('infra');
    expect(result.errorMessage).toContain('GitLab is unavailable');
  });

  it('should_return_error_when_every_project_failed', () => {
    const result = summarizeSyncRun([
      {
        projectAlias: 'api',
        success: false,
        errorMessage: 'GitLab rejected the token',
      },
      {
        projectAlias: 'web',
        success: false,
        errorMessage: 'GitLab rejected the token',
      },
    ]);
    expect(result.status).toBe('error');
    expect(result.mrCount).toBe(0);
    expect(result.errorMessage).toBe(
      'api: GitLab rejected the token; web: GitLab rejected the token',
    );
  });

  it('should_not_prefix_an_outcome_with_an_empty_alias', () => {
    // RG-019-16 : une connexion sans jeton échoue en un seul message déjà
    // formé, listant elle-même ses repos — jamais re-préfixé par un alias.
    const result = summarizeSyncRun([
      {
        projectAlias: '',
        success: false,
        errorMessage: 'Aucun jeton (gitlab.exemple.fr) : api, web',
      },
    ]);
    expect(result.errorMessage).toBe(
      'Aucun jeton (gitlab.exemple.fr) : api, web',
    );
  });
});
