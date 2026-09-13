import { ForgeUser } from '../../forges/types/forge-user';
import { resolveGithubReviewers } from './resolve-github-reviewers';

const user = (username: string): ForgeUser => ({
  remoteUserId: username,
  username,
  name: username,
  avatarUrl: null,
  webUrl: `https://github.com/${username}`,
});

describe('resolveGithubReviewers', () => {
  it('should_list_requested_reviewers_then_review_authors', () => {
    expect(
      resolveGithubReviewers([user('pmartin')], [user('mdupont')], 'kbenali'),
    ).toEqual([user('pmartin'), user('mdupont')]);
  });

  it('should_deduplicate_a_reviewer_present_in_both_lists', () => {
    expect(
      resolveGithubReviewers(
        [user('pmartin')],
        [user('pmartin'), user('mdupont')],
        'kbenali',
      ),
    ).toEqual([user('pmartin'), user('mdupont')]);
  });

  it('should_deduplicate_case_insensitively', () => {
    expect(
      resolveGithubReviewers([user('PMartin')], [user('pmartin')], 'kbenali'),
    ).toEqual([user('PMartin')]);
  });

  it('should_exclude_the_author_from_requested_reviewers', () => {
    expect(resolveGithubReviewers([user('kbenali')], [], 'kbenali')).toEqual(
      [],
    );
  });

  it('should_exclude_the_author_from_review_authors', () => {
    expect(resolveGithubReviewers([], [user('kbenali')], 'kbenali')).toEqual(
      [],
    );
  });

  it('should_exclude_the_author_case_insensitively', () => {
    expect(resolveGithubReviewers([], [user('KBenali')], 'kbenali')).toEqual(
      [],
    );
  });

  it('should_return_an_empty_array_when_nobody_is_involved', () => {
    expect(resolveGithubReviewers([], [], 'kbenali')).toEqual([]);
  });
});
