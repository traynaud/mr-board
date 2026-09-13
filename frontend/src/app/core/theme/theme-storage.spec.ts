import { readStoredTheme, THEME_STORAGE_KEY, writeStoredTheme } from './theme-storage';

describe('theme-storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  describe('readStoredTheme', () => {
    it('should_return_null_when_nothing_is_stored', () => {
      expect(readStoredTheme()).toBeNull();
    });

    it('should_return_the_stored_valid_preference', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'dark');

      expect(readStoredTheme()).toBe('dark');
    });

    it('should_return_null_for_a_corrupted_value', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'blue');

      expect(readStoredTheme()).toBeNull();
    });

    it('should_return_null_when_localStorage_is_unavailable', () => {
      vi.stubGlobal('localStorage', {
        getItem: () => {
          throw new Error('unavailable');
        },
      });

      expect(readStoredTheme()).toBeNull();
    });
  });

  describe('writeStoredTheme', () => {
    it('should_persist_the_preference', () => {
      writeStoredTheme('light');

      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    });

    it('should_stay_silent_when_localStorage_is_unavailable', () => {
      vi.stubGlobal('localStorage', {
        setItem: () => {
          throw new Error('unavailable');
        },
      });

      expect(() => writeStoredTheme('dark')).not.toThrow();
    });
  });
});
