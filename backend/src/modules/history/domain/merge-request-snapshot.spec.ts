import { ForgeMergeRequest } from '../../forges/types/forge-merge-request.js';
import {
  involvedUsernamesJson,
  snapshotFromForge,
} from './merge-request-snapshot.js';

describe('snapshotFromForge', () => {
  it('should_project_only_the_watched_fields', () => {
    const user = {
      remoteUserId: '1',
      username: 'alice',
      name: 'Alice',
      avatarUrl: 'https://a/b.png',
      webUrl: 'https://a/alice',
    };
    const forge = {
      iid: 5,
      title: 'T',
      webUrl: 'https://x/5',
      draft: true,
      labels: ['bug'],
      reviewers: [user],
      assignees: [user],
      approvedBy: [user],
      commentsCount: 4,
      author: user,
    } as unknown as ForgeMergeRequest;

    expect(snapshotFromForge(forge)).toEqual({
      iid: 5,
      title: 'T',
      webUrl: 'https://x/5',
      draft: true,
      labels: ['bug'],
      reviewers: [{ remoteUserId: '1', username: 'alice', name: 'Alice' }],
      assignees: [{ remoteUserId: '1', username: 'alice', name: 'Alice' }],
      approvers: [{ remoteUserId: '1', username: 'alice', name: 'Alice' }],
      commentsCount: 4,
      authorUsername: 'alice',
    });
  });
});

describe('involvedUsernamesJson', () => {
  const user = (username: string) => ({
    remoteUserId: username,
    username,
    name: username,
  });

  it('should_list_author_reviewers_and_assignees_without_duplicates', () => {
    expect(
      involvedUsernamesJson({
        authorUsername: 'alice',
        reviewers: [user('bob'), user('alice')],
        assignees: [user('carol'), user('bob')],
      }),
    ).toBe('["alice","bob","carol"]');
  });

  it('should_skip_an_unknown_author', () => {
    expect(
      involvedUsernamesJson({ reviewers: [], assignees: [user('bob')] }),
    ).toBe('["bob"]');
  });
});
