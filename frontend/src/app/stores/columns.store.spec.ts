import { TestBed } from '@angular/core/testing';
import { ColumnsStore } from './columns.store';

describe('ColumnsStore', () => {
  let store: InstanceType<typeof ColumnsStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(ColumnsStore);
  });

  it('should_default_to_the_status_column_visible_and_the_opened_and_labels_columns_hidden', () => {
    expect(store.showStatus()).toBe(true);
    expect(store.showOpened()).toBe(false);
    expect(store.showLabels()).toBe(false);
  });

  it('should_toggle_the_status_column', () => {
    store.toggleStatus();
    expect(store.showStatus()).toBe(false);

    store.toggleStatus();
    expect(store.showStatus()).toBe(true);
  });

  it('should_toggle_the_opened_column', () => {
    store.toggleOpened();
    expect(store.showOpened()).toBe(true);

    store.toggleOpened();
    expect(store.showOpened()).toBe(false);
  });

  it('should_toggle_the_labels_column_rg_028_05', () => {
    store.toggleLabels();
    expect(store.showLabels()).toBe(true);

    store.toggleLabels();
    expect(store.showLabels()).toBe(false);
  });

  it('should_restore_the_state_from_the_url', () => {
    store.restore(false, true, true);
    expect(store.showStatus()).toBe(false);
    expect(store.showOpened()).toBe(true);
    expect(store.showLabels()).toBe(true);

    store.restore(true, false, false);
    expect(store.showStatus()).toBe(true);
    expect(store.showOpened()).toBe(false);
    expect(store.showLabels()).toBe(false);
  });
});
