import { TestBed } from '@angular/core/testing';
import { ColumnsStore } from './columns.store';

describe('ColumnsStore', () => {
  let store: InstanceType<typeof ColumnsStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(ColumnsStore);
  });

  it('should_default_to_the_opened_column_hidden', () => {
    expect(store.showOpened()).toBe(false);
  });

  it('should_toggle_the_opened_column', () => {
    store.toggleOpened();
    expect(store.showOpened()).toBe(true);

    store.toggleOpened();
    expect(store.showOpened()).toBe(false);
  });

  it('should_restore_the_state_from_the_url', () => {
    store.restore(true);
    expect(store.showOpened()).toBe(true);

    store.restore(false);
    expect(store.showOpened()).toBe(false);
  });
});
