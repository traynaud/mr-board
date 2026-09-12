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
  draft: false,
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
  createdAt: '2026-09-01T10:00:00.000Z',
  readyAt: '2026-09-01T10:00:00.000Z',
  readyDays: 6,
  readyLevel: 'red',
  openedDays: 6,
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

  it('should_default_to_ready_ascending_and_pass_it_to_the_api', async () => {
    api.getMergeRequests.mockReturnValue(of([MR]));

    expect(store.sort()).toEqual({ key: 'ready', direction: 'asc' });
    await store.load();

    expect(api.getMergeRequests).toHaveBeenCalledWith({ key: 'ready', direction: 'asc' });
  });

  it('should_switch_to_ascending_when_a_different_column_is_selected', async () => {
    api.getMergeRequests.mockReturnValue(of([MR]));

    store.setSort('diff');
    await Promise.resolve();

    expect(store.sort()).toEqual({ key: 'diff', direction: 'asc' });
  });

  it('should_toggle_the_direction_when_the_same_column_is_selected_again', async () => {
    api.getMergeRequests.mockReturnValue(of([MR]));

    store.setSort('ready'); // already 'ready', asc → desc
    await Promise.resolve();
    expect(store.sort()).toEqual({ key: 'ready', direction: 'desc' });

    store.setSort('ready'); // desc → asc
    await Promise.resolve();
    expect(store.sort()).toEqual({ key: 'ready', direction: 'asc' });
  });

  it('should_reload_the_merge_requests_when_the_sort_changes', () => {
    api.getMergeRequests.mockReturnValue(of([MR]));
    api.getMergeRequests.mockClear();

    store.setSort('diff');

    expect(api.getMergeRequests).toHaveBeenCalledWith({ key: 'diff', direction: 'asc' });
  });
});
