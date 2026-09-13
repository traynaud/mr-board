import { hasRequiredScope } from './check-github-token-scopes';

describe('hasRequiredScope', () => {
  it.each([['repo'], ['public_repo']])(
    'should_accept_the_%s_scope',
    (scope) => {
      expect(hasRequiredScope([scope])).toBe(true);
    },
  );

  it('should_accept_when_the_required_scope_is_among_others', () => {
    expect(hasRequiredScope(['read:org', 'repo'])).toBe(true);
  });

  it('should_reject_when_no_accepted_scope_is_present', () => {
    expect(hasRequiredScope(['read:user', 'read:org'])).toBe(false);
  });

  it('should_reject_an_empty_scope_list', () => {
    expect(hasRequiredScope([])).toBe(false);
  });
});
