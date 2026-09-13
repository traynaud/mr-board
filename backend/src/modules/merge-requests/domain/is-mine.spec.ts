import { isMe, isMine } from './is-mine';

function subject(
  overrides: Partial<{
    authorUsername: string;
    reviewerUsernames: string[];
    assigneeUsernames: string[];
  }> = {},
) {
  return {
    authorUsername: 'jdurand',
    reviewerUsernames: [],
    assigneeUsernames: [],
    ...overrides,
  };
}

describe('isMine', () => {
  it('should_return_true_when_the_username_matches_the_author', () => {
    expect(
      isMine(subject({ authorUsername: 'mdupont' }), {
        username: 'mdupont',
        email: null,
      }),
    ).toBe(true);
  });

  it('should_be_case_insensitive', () => {
    expect(
      isMine(subject({ authorUsername: 'MDupont' }), {
        username: 'mdupont',
        email: null,
      }),
    ).toBe(true);
  });

  it('should_return_true_when_the_username_matches_one_of_several_reviewers', () => {
    expect(
      isMine(subject({ reviewerUsernames: ['tgirard', 'mdupont'] }), {
        username: 'mdupont',
        email: null,
      }),
    ).toBe(true);
  });

  it('should_return_true_when_the_username_matches_an_assignee', () => {
    expect(
      isMine(subject({ assigneeUsernames: ['mdupont'] }), {
        username: 'mdupont',
        email: null,
      }),
    ).toBe(true);
  });

  it('should_return_false_when_nothing_matches', () => {
    expect(
      isMine(
        subject({
          authorUsername: 'jdurand',
          reviewerUsernames: ['tgirard'],
          assigneeUsernames: ['lrousseau'],
        }),
        { username: 'mdupont', email: null },
      ),
    ).toBe(false);
  });

  it('should_return_false_when_the_identity_is_entirely_empty', () => {
    expect(
      isMine(subject({ authorUsername: 'mdupont' }), {
        username: null,
        email: null,
      }),
    ).toBe(false);
  });

  it('should_prefer_the_username_over_the_email_when_both_are_set', () => {
    expect(
      isMine(subject({ authorUsername: 'marie@exemple.fr' }), {
        username: 'mdupont',
        email: 'marie@exemple.fr',
      }),
    ).toBe(false);
  });

  it('should_never_match_via_the_email_fallback_in_practice_since_no_subject_carries_an_email', () => {
    // Documented limitation (RG-G09): the email fallback is implemented
    // faithfully but is a no-op, because author/reviewer/assignee records
    // only ever carry a GitLab username, never the matching email address.
    expect(
      isMine(subject({ authorUsername: 'mdupont' }), {
        username: null,
        email: 'marie@exemple.fr',
      }),
    ).toBe(false);
  });
});

describe('isMe', () => {
  it('should_return_true_when_the_username_matches', () => {
    expect(isMe('mdupont', { username: 'mdupont', email: null })).toBe(true);
  });

  it('should_be_case_insensitive', () => {
    expect(isMe('MDupont', { username: 'mdupont', email: null })).toBe(true);
  });

  it('should_return_false_when_the_username_does_not_match', () => {
    expect(isMe('tgirard', { username: 'mdupont', email: null })).toBe(false);
  });

  it('should_return_false_when_the_identity_is_entirely_empty', () => {
    expect(isMe('mdupont', { username: null, email: null })).toBe(false);
  });

  it('should_fall_back_to_the_email_when_the_username_is_unset', () => {
    expect(
      isMe('marie@exemple.fr', { username: null, email: 'marie@exemple.fr' }),
    ).toBe(true);
  });

  it('should_prefer_the_username_over_the_email_when_both_are_set', () => {
    expect(
      isMe('marie@exemple.fr', {
        username: 'mdupont',
        email: 'marie@exemple.fr',
      }),
    ).toBe(false);
  });
});
