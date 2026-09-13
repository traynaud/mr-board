import { vi } from 'vitest';

/**
 * Stub `window.matchMedia`, non implémenté par jsdom, pour les tests qui
 * instancient (directement ou via injection) `ThemeService`. À appeler avant
 * la création du composant/service ; `vi.unstubAllGlobals()` en nettoie
 * l'effet dans un `afterEach`.
 */
export function stubMatchMedia(matches = false): {
  matches: boolean;
  listeners: ((event: { matches: boolean }) => void)[];
} {
  const state = { matches, listeners: [] as ((event: { matches: boolean }) => void)[] };
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      get matches() {
        return state.matches;
      },
      media: query,
      addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => {
        state.listeners.push(listener);
      },
      removeEventListener: () => {
        // Non nécessaire pour les tests actuels.
      },
      // API dépréciée, encore utilisée par Angular CDK (`BreakpointObserver`).
      addListener: (listener: (event: { matches: boolean }) => void) => {
        state.listeners.push(listener);
      },
      removeListener: () => {
        // Non nécessaire pour les tests actuels.
      },
    })),
  );
  return state;
}
