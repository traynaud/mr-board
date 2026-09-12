import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '../core/api/api-error';
import { MergeRequestsService } from '../core/api/merge-requests.service';
import { MergeRequestView } from '../models/merge-request.model';
import { MergeRequestsStore } from './merge-requests.store';

const MR: MergeRequestView = {
  id: 1,
  projectAlias: 'api',
  iid: 7,
  title: 'Refonte facturation',
  webUrl: 'https://gitlab.com/equipe/api/-/merge_requests/7',
  author: { username: 'mdupont', name: 'Marie Dupont', avatarUrl: null },
  reviewers: [],
  assignees: [],
  approved: false,
  commentsCount: 0,
  difficulty: 'easy',
  changedFiles: 1,
  additions: 1,
  deletions: 0,
  changedLines: 1,
};

describe('MergeRequestsStore', () => {
  const api = { getMergeRequests: vi.fn() };
  let store: InstanceType<typeof MergeRequestsStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [{ provide: MergeRequestsService, useValue: api }] });
    store = TestBed.inject(MergeRequestsStore);
  });

  it('should_load_merge_requests', async () => {
    api.getMergeRequests.mockReturnValue(of([MR]));

    const pending = store.load();
    expect(store.loading()).toBe(true);
    await pending;

    expect(store.loading()).toBe(false);
    expect(store.mergeRequests()).toEqual([MR]);
    expect(store.loadError()).toBeNull();
  });

  it('should_expose_load_error_key_and_keep_loading_false', async () => {
    api.getMergeRequests.mockReturnValue(throwError(() => new ApiError(0, undefined, 'down')));

    await store.load();

    expect(store.loading()).toBe(false);
    expect(store.loadError()).toBe('errors.network');
  });

  it('should_not_clear_existing_merge_requests_when_a_reload_fails', async () => {
    api.getMergeRequests.mockReturnValueOnce(of([MR]));
    await store.load();

    api.getMergeRequests.mockReturnValueOnce(
      throwError(() => new ApiError(500, undefined, 'boom')),
    );
    await store.load();

    expect(store.mergeRequests()).toEqual([MR]);
    expect(store.loadError()).toBe('errors.unexpected');
  });
});
