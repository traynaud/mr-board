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

  it('should_default_to_no_search_rg_026_08', () => {
    expect(store.search()).toBe('');
  });

  it('should_set_the_search_value', () => {
    store.setSearch('facturation');
    expect(store.search()).toBe('facturation');
  });

  it('should_clear_the_search_along_with_mine_and_composable_filters_rg_026_11', () => {
    store.toggleDrafts();
    store.setSearch('facturation');

    store.clear();

    expect(store.search()).toBe('');
    expect(store.drafts()).toBe(true);
  });

  it('should_default_to_no_active_composable_filter', () => {
    expect(store.active()).toEqual([]);
    expect(store.composableFilters()).toEqual({
      connection: [],
      project: [],
      author: [],
      assigned: [],
      approved: null,
      commented: null,
    });
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

  describe('restore', () => {
    it('should_patch_the_search_value_rg_026_10', () => {
      store.restore({ search: 'facturation' });
      expect(store.search()).toBe('facturation');
    });

    it('should_patch_the_whole_state_in_one_shot', () => {
      store.restore({
        drafts: true,
        mine: true,
        active: ['project', 'approved'],
        project: ['api'],
        approved: 'yes',
      });

      expect(store.drafts()).toBe(true);
      expect(store.mine()).toBe(true);
      expect(store.active()).toEqual(['project', 'approved']);
      expect(store.project()).toEqual(['api']);
      expect(store.approved()).toBe('yes');
      expect(store.author()).toEqual([]);
    });

    it('should_leave_unspecified_fields_untouched', () => {
      store.toggleDrafts();

      store.restore({ mine: true });

      expect(store.drafts()).toBe(true);
      expect(store.mine()).toBe(true);
    });
  });

  describe('addFilter', () => {
    it('should_add_a_filter_to_the_active_list', () => {
      store.addFilter('project');

      expect(store.active()).toEqual(['project']);
    });

    it('should_preserve_the_order_filters_were_added_in', () => {
      store.addFilter('approved');
      store.addFilter('project');

      expect(store.active()).toEqual(['approved', 'project']);
    });

    it('should_have_no_effect_when_the_filter_is_already_active', () => {
      store.addFilter('project');
      store.addFilter('project');

      expect(store.active()).toEqual(['project']);
    });
  });

  describe('removeFilter', () => {
    it('should_remove_the_pill_and_reset_a_multi_value_filter', () => {
      store.addFilter('project');
      store.toggleMultiValue('project', 'api');

      store.removeFilter('project');

      expect(store.active()).toEqual([]);
      expect(store.project()).toEqual([]);
    });

    it('should_remove_the_pill_and_reset_a_boolean_filter_to_null', () => {
      store.addFilter('approved');
      store.setBoolean('approved', 'yes');

      store.removeFilter('approved');

      expect(store.active()).toEqual([]);
      expect(store.approved()).toBeNull();
    });

    it('should_remove_the_connection_filter_rg_021_03', () => {
      store.addFilter('connection');
      store.toggleMultiValue('connection', 'gitlab.com');

      store.removeFilter('connection');

      expect(store.active()).toEqual([]);
      expect(store.connection()).toEqual([]);
    });
  });

  describe('toggleMultiValue', () => {
    it('should_add_a_value_not_yet_selected', () => {
      store.toggleMultiValue('project', 'api');

      expect(store.project()).toEqual(['api']);
    });

    it('should_toggle_the_connection_filter_rg_021_03', () => {
      store.toggleMultiValue('connection', 'gitlab.com');
      store.toggleMultiValue('connection', 'github.com');

      expect(store.connection()).toEqual(['gitlab.com', 'github.com']);

      store.toggleMultiValue('connection', 'gitlab.com');

      expect(store.connection()).toEqual(['github.com']);
    });

    it('should_remove_a_value_already_selected', () => {
      store.toggleMultiValue('assigned', 'nobody');
      store.toggleMultiValue('assigned', 'mdupont');

      store.toggleMultiValue('assigned', 'nobody');

      expect(store.assigned()).toEqual(['mdupont']);
    });
  });

  describe('setMultiValue', () => {
    it('should_replace_the_whole_selection_without_toggling', () => {
      store.toggleMultiValue('author', 'mdupont');

      store.setMultiValue('author', ['kbenali']);

      expect(store.author()).toEqual(['kbenali']);
    });
  });

  describe('setBoolean', () => {
    it('should_select_a_value', () => {
      store.setBoolean('approved', 'yes');

      expect(store.approved()).toBe('yes');
    });

    it('should_deselect_when_reclicking_the_same_value', () => {
      store.setBoolean('commented', 'no');

      store.setBoolean('commented', 'no');

      expect(store.commented()).toBeNull();
    });

    it('should_switch_to_the_other_value_when_it_differs', () => {
      store.setBoolean('approved', 'yes');

      store.setBoolean('approved', 'no');

      expect(store.approved()).toBe('no');
    });
  });

  it('should_clear_every_active_pill_and_composable_filter_value_but_not_drafts', () => {
    store.toggleDrafts();
    store.addFilter('connection');
    store.toggleMultiValue('connection', 'gitlab.com');
    store.addFilter('project');
    store.toggleMultiValue('project', 'api');
    store.addFilter('approved');
    store.setBoolean('approved', 'yes');

    store.clear();

    expect(store.drafts()).toBe(true);
    expect(store.mine()).toBe(false);
    expect(store.active()).toEqual([]);
    expect(store.connection()).toEqual([]);
    expect(store.project()).toEqual([]);
    expect(store.approved()).toBeNull();
  });
});
