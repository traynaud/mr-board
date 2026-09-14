import { MergeRequestUser, MergeRequestView } from '../models/merge-request.model';
import { findNewAssignments } from './assignment-diff';

function user(username: string, isMe = false): MergeRequestUser {
  return { username, name: username, avatarUrl: null, isMe };
}

const CONNECTION = { id: 1, name: 'GitLab', type: 'gitlab' as const };

function mr(overrides: Partial<MergeRequestView> = {}): MergeRequestView {
  return {
    id: 1,
    projectAlias: 'api',
    iid: 42,
    title: 'Titre',
    webUrl: 'https://gitlab.com/equipe/api/-/merge_requests/42',
    draft: false,
    author: user('adurand'),
    reviewers: [],
    assignees: [],
    approved: false,
    commentsCount: 0,
    difficulty: 'easy',
    changedFiles: 1,
    additions: 1,
    deletions: 0,
    changedLines: 1,
    createdAt: '2026-09-01T00:00:00.000Z',
    readyAt: '2026-09-01T00:00:00.000Z',
    readyDays: 1,
    readyLevel: 'green',
    openedDays: 1,
    isMine: false,
    isFavorite: false,
    mergeStatus: { state: 'mergeable', reasons: [] },
    connection: CONNECTION,
    ...overrides,
  };
}

describe('findNewAssignments', () => {
  it('should_detect_a_merge_request_newly_assigned_as_reviewer', () => {
    const previous = [mr({ id: 1, reviewers: [] })];
    const current = [mr({ id: 1, reviewers: [user('mdupont', true)] })];

    expect(findNewAssignments(previous, current)).toEqual([
      {
        id: 1,
        projectAlias: 'api',
        connectionName: 'GitLab',
        iid: 42,
        title: 'Titre',
        webUrl: 'https://gitlab.com/equipe/api/-/merge_requests/42',
      },
    ]);
  });

  it('should_detect_a_merge_request_newly_assigned_as_assignee', () => {
    const previous = [mr({ id: 1, assignees: [] })];
    const current = [mr({ id: 1, assignees: [user('mdupont', true)] })];

    expect(findNewAssignments(previous, current)).toHaveLength(1);
  });

  it('should_treat_a_merge_request_absent_from_previous_as_new', () => {
    const current = [mr({ id: 1, reviewers: [user('mdupont', true)] })];

    expect(findNewAssignments([], current)).toHaveLength(1);
  });

  it('should_ignore_a_merge_request_already_assigned_before', () => {
    const previous = [mr({ id: 1, reviewers: [user('mdupont', true)] })];
    const current = [mr({ id: 1, reviewers: [user('mdupont', true)] })];

    expect(findNewAssignments(previous, current)).toEqual([]);
  });

  it('should_ignore_a_draft_even_when_newly_assigned', () => {
    const previous = [mr({ id: 1, draft: true, reviewers: [] })];
    const current = [mr({ id: 1, draft: true, reviewers: [user('mdupont', true)] })];

    expect(findNewAssignments(previous, current)).toEqual([]);
  });

  it('should_ignore_a_merge_request_not_assigned_to_me', () => {
    const previous = [mr({ id: 1, reviewers: [] })];
    const current = [mr({ id: 1, reviewers: [user('kbenali', false)] })];

    expect(findNewAssignments(previous, current)).toEqual([]);
  });
});
