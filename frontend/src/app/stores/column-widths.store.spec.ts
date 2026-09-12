import { TestBed } from '@angular/core/testing';
import { ColumnWidthsStore, DEFAULT_COLUMN_WIDTHS } from './column-widths.store';

const STORAGE_KEY = 'mrboard.columns.v1';

describe('ColumnWidthsStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    // `Storage.prototype` est mutée globalement par certains tests
    // (localStorage indisponible) — restaurée pour ne pas fuiter sur les
    // tests suivants.
    vi.restoreAllMocks();
  });

  function store(): InstanceType<typeof ColumnWidthsStore> {
    return TestBed.inject(ColumnWidthsStore);
  }

  it('should_default_to_the_default_widths_when_localStorage_is_empty', () => {
    expect(store().widths()).toEqual(DEFAULT_COLUMN_WIDTHS);
  });

  describe('setWidth', () => {
    it('should_override_a_single_column_width', () => {
      store().setWidth('project', 120);

      expect(store().widths()).toEqual({ ...DEFAULT_COLUMN_WIDTHS, project: 120 });
    });

    it('should_clamp_to_the_minimum_width', () => {
      store().setWidth('author', 10);

      expect(store().widths().author).toBe(40);
    });

    it('should_clamp_to_the_maximum_width', () => {
      store().setWidth('author', 5000);

      expect(store().widths().author).toBe(800);
    });

    it('should_persist_the_override_to_localStorage', () => {
      store().setWidth('project', 120);

      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({ project: 120 });
    });

    it('should_not_throw_when_localStorage_setItem_fails', () => {
      const s = store();
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota exceeded');
      });

      expect(() => s.setWidth('project', 120)).not.toThrow();
      expect(s.widths().project).toBe(120);
    });
  });

  describe('resetOne', () => {
    it('should_reset_only_the_given_column_to_its_default', () => {
      const s = store();
      s.setWidth('project', 120);
      s.setWidth('author', 90);

      s.resetOne('project');

      expect(s.widths()).toEqual({ ...DEFAULT_COLUMN_WIDTHS, author: 90 });
    });

    it('should_persist_the_removal_to_localStorage', () => {
      const s = store();
      s.setWidth('project', 120);
      s.setWidth('author', 90);

      s.resetOne('project');

      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({ author: 90 });
    });
  });

  describe('resetAll', () => {
    it('should_reset_every_column_to_its_default', () => {
      const s = store();
      s.setWidth('project', 120);
      s.setWidth('author', 90);

      s.resetAll();

      expect(s.widths()).toEqual(DEFAULT_COLUMN_WIDTHS);
    });

    it('should_remove_the_localStorage_key', () => {
      const s = store();
      s.setWidth('project', 120);

      s.resetAll();

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('should_not_throw_when_localStorage_removeItem_fails', () => {
      const s = store();
      s.setWidth('project', 120);
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('unavailable');
      });

      expect(() => s.resetAll()).not.toThrow();
      expect(s.widths()).toEqual(DEFAULT_COLUMN_WIDTHS);
    });
  });

  describe('restauration depuis localStorage au chargement', () => {
    it('should_restore_valid_overrides_saved_previously', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ project: 100, ready: 200 }));

      expect(store().widths()).toEqual({ ...DEFAULT_COLUMN_WIDTHS, project: 100, ready: 200 });
    });

    it('should_ignore_invalid_json', () => {
      localStorage.setItem(STORAGE_KEY, 'not json');

      expect(store().widths()).toEqual(DEFAULT_COLUMN_WIDTHS);
    });

    it('should_ignore_a_non_object_value', () => {
      localStorage.setItem(STORAGE_KEY, '42');

      expect(store().widths()).toEqual(DEFAULT_COLUMN_WIDTHS);
    });

    it('should_ignore_an_unknown_column_key', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ unknownColumn: 100 }));

      expect(store().widths()).toEqual(DEFAULT_COLUMN_WIDTHS);
    });

    it('should_ignore_an_out_of_range_value', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ project: 10, author: 5000 }));

      expect(store().widths()).toEqual(DEFAULT_COLUMN_WIDTHS);
    });

    it('should_ignore_a_non_numeric_value', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ project: '120' }));

      expect(store().widths()).toEqual(DEFAULT_COLUMN_WIDTHS);
    });

    it('should_default_to_default_widths_without_throwing_when_localStorage_getItem_fails', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('unavailable');
      });

      expect(() => store().widths()).not.toThrow();
      expect(store().widths()).toEqual(DEFAULT_COLUMN_WIDTHS);
    });
  });
});
