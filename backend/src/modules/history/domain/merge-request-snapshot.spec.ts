import { ForgeMergeRequest } from '../../forges/types/forge-merge-request.js';
import { snapshotFromForge } from './merge-request-snapshot.js';

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
    });
  });
});
