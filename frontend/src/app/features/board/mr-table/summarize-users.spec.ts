import { MergeRequestUser } from '../../../models/merge-request.model';
import { summarizeUsers } from './summarize-users';

function user(name: string): MergeRequestUser {
  return { username: name.toLowerCase(), name, avatarUrl: null };
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
});
