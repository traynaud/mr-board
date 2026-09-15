import { tokenHint } from './token-hint.js';

describe('tokenHint', () => {
  it('should_return_last_four_characters', () => {
    expect(tokenHint('glpat-abcdefghijklmnwxyz')).toBe('wxyz');
  });

  it('should_return_whole_value_when_shorter_than_hint', () => {
    expect(tokenHint('abc')).toBe('abc');
  });
});
