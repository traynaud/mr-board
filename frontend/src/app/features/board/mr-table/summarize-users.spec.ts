import { MergeRequestUser } from '../../../models/merge-request.model';
import { summarizeUsers } from './summarize-users';

function user(name: string, isMe = false): MergeRequestUser {
  return { username: name.toLowerCase(), name, avatarUrl: null, isMe };
}

describe('summarizeUsers', () => {
  it('should_return_a_null_first_user_for_an_empty_list', () => {
    expect(summarizeUsers([])).toEqual({ first: null, extraCount: 0, tooltip: '' });
  });

  it('should_return_the_only_user_with_no_extra_count', () => {
    const marie = user('Marie Dupont');
    expect(summarizeUsers([marie])).toEqual({
      first: marie,
      extraCount: 0,
      tooltip: 'Marie Dupont',
    });
  });

  it('should_return_the_first_user_and_the_remaining_count', () => {
    const marie = user('Marie Dupont');
    const tom = user('Tom Girard');
    expect(summarizeUsers([marie, tom])).toEqual({
      first: marie,
      extraCount: 1,
      tooltip: 'Marie Dupont, Tom Girard',
    });
  });

  it('should_promote_me_to_first_when_highlight_me_is_true_and_i_am_not_first', () => {
    const karim = user('Karim Benali');
    const marie = user('Marie Dupont', true);
    const result = summarizeUsers([karim, marie], true);

    expect(result.first).toBe(marie);
  });

  it('should_keep_the_gitlab_order_in_tooltip_and_extra_count_even_when_promoted', () => {
    const karim = user('Karim Benali');
    const marie = user('Marie Dupont', true);
    const result = summarizeUsers([karim, marie], true);

    expect(result.tooltip).toBe('Karim Benali, Marie Dupont');
    expect(result.extraCount).toBe(1);
  });

  it('should_not_promote_when_highlight_me_is_false_even_if_i_am_not_first', () => {
    const karim = user('Karim Benali');
    const marie = user('Marie Dupont', true);
    const result = summarizeUsers([karim, marie], false);

    expect(result.first).toBe(karim);
  });

  it('should_default_highlight_me_to_true_when_omitted', () => {
    const karim = user('Karim Benali');
    const marie = user('Marie Dupont', true);
    const result = summarizeUsers([karim, marie]);

    expect(result.first).toBe(marie);
  });

  it('should_keep_the_first_user_when_nobody_is_me', () => {
    const karim = user('Karim Benali');
    const tom = user('Tom Girard');
    const result = summarizeUsers([karim, tom], true);

    expect(result.first).toBe(karim);
  });
});
