import { LANGUAGE_STORAGE_KEY, readStoredLanguage, writeStoredLanguage } from './language-storage';

describe('language-storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  describe('readStoredLanguage', () => {
    it('should_return_null_when_nothing_is_stored', () => {
      expect(readStoredLanguage()).toBeNull();
    });

    it('should_return_the_stored_valid_language', () => {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');

      expect(readStoredLanguage()).toBe('en');
    });

    it('should_return_null_for_a_corrupted_value', () => {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, 'de');

      expect(readStoredLanguage()).toBeNull();
    });

    it('should_return_null_when_localStorage_is_unavailable', () => {
      vi.stubGlobal('localStorage', {
        getItem: () => {
          throw new Error('unavailable');
        },
      });

      expect(readStoredLanguage()).toBeNull();
    });
  });

  describe('writeStoredLanguage', () => {
    it('should_persist_the_language', () => {
      writeStoredLanguage('en');

      expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    });

    it('should_stay_silent_when_localStorage_is_unavailable', () => {
      vi.stubGlobal('localStorage', {
        setItem: () => {
          throw new Error('unavailable');
        },
      });

      expect(() => writeStoredLanguage('fr')).not.toThrow();
    });
  });
});
