import { TestBed } from '@angular/core/testing';
import { FiltersStore } from './filters.store';

describe('FiltersStore', () => {
  let store: InstanceType<typeof FiltersStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(FiltersStore);
  });

  it('should_default_to_drafts_hidden_and_mine_inactive', () => {
    expect(store.drafts()).toBe(false);
    expect(store.mine()).toBe(false);
  });

  it('should_toggle_drafts', () => {
    store.toggleDrafts();
    expect(store.drafts()).toBe(true);

    store.toggleDrafts();
    expect(store.drafts()).toBe(false);
  });

  it('should_toggle_mine', () => {
    store.toggleMine();
    expect(store.mine()).toBe(true);

    store.toggleMine();
    expect(store.mine()).toBe(false);
  });

  it('should_clear_mine_only_and_never_touch_drafts', () => {
    store.toggleDrafts();
    store.toggleMine();

    store.clear();

    expect(store.mine()).toBe(false);
    expect(store.drafts()).toBe(true);
  });
});
