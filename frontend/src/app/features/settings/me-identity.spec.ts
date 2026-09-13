import { TestConnectionState } from '../../models/connection.model';
import { resolveMeIdentity } from './me-identity';

const IDLE: TestConnectionState = { status: 'idle', result: null, errorKey: null };
const PENDING: TestConnectionState = { status: 'pending', result: null, errorKey: null };
const ERROR: TestConnectionState = {
  status: 'error',
  result: null,
  errorKey: 'errors.gitlab.auth',
};
const SUCCESS = (username: string): TestConnectionState => ({
  status: 'success',
  errorKey: null,
  result: {
    username,
    name: 'Marie Dupont',
    avatarUrl: 'https://gitlab.com/a.png',
    expiresAt: null,
    expirationKnown: true,
  },
});

describe('resolveMeIdentity', () => {
  it('should_be_unset_when_username_is_empty_or_blank', () => {
    expect(resolveMeIdentity('', IDLE)).toEqual({
      status: 'unset',
      username: null,
      name: null,
      avatarUrl: null,
    });
    expect(resolveMeIdentity('   ', SUCCESS('mdupont'))).toEqual({
      status: 'unset',
      username: null,
      name: null,
      avatarUrl: null,
    });
  });

  it('should_match_case_insensitively_and_trim', () => {
    expect(resolveMeIdentity(' MDupont ', SUCCESS('mdupont'))).toEqual({
      status: 'matched',
      username: 'MDupont',
      name: 'Marie Dupont',
      avatarUrl: 'https://gitlab.com/a.png',
    });
  });

  it('should_be_mismatch_when_test_succeeded_for_another_username', () => {
    expect(resolveMeIdentity('kbenali', SUCCESS('mdupont'))).toEqual({
      status: 'mismatch',
      username: 'kbenali',
      name: null,
      avatarUrl: null,
    });
  });

  it.each([IDLE, PENDING, ERROR])(
    'should_be_manual_when_no_test_succeeded_yet (%j)',
    (test) => {
      expect(resolveMeIdentity('lrousseau', test)).toEqual({
        status: 'manual',
        username: 'lrousseau',
        name: null,
        avatarUrl: null,
      });
    },
  );
});
