import { BusinessValidationException } from '../../../common/exceptions/index.js';
import {
  buildHistoryFilter,
  toLikePattern,
  UNKNOWN_ACTOR,
} from './history-filter.js';

describe('buildHistoryFilter', () => {
  it('returns an empty filter without input', () => {
    expect(buildHistoryFilter({})).toEqual({
      terms: [],
      iid: null,
      types: [],
      actors: [],
      includeUnknownActor: false,
      projectIds: [],
      from: null,
      to: null,
    });
  });

  it('normalises the search like the board (case, accents, spaces, iid)', () => {
    const filter = buildHistoryFilter({ q: '  Réfacto   FACT ' });
    expect(filter.terms).toEqual(['refacto', 'fact']);
    expect(filter.iid).toBeNull();
    expect(buildHistoryFilter({ q: '!128' }).iid).toBe(128);
    expect(buildHistoryFilter({ q: '#128' }).iid).toBe(128);
    expect(buildHistoryFilter({ q: '128' }).iid).toBe(128);
  });

  it('separates the unknown actor from usernames', () => {
    const filter = buildHistoryFilter({ actor: ['alice', UNKNOWN_ACTOR] });
    expect(filter.actors).toEqual(['alice']);
    expect(filter.includeUnknownActor).toBe(true);
  });

  it('normalises the period to ISO instants', () => {
    const filter = buildHistoryFilter({
      from: '2026-11-06T00:00:00+01:00',
      to: '2026-11-09T00:00:00.000Z',
    });
    expect(filter.from).toBe('2026-11-05T23:00:00.000Z');
    expect(filter.to).toBe('2026-11-09T00:00:00.000Z');
  });

  it('accepts a single bound and an empty range', () => {
    expect(buildHistoryFilter({ from: '2026-11-06T00:00:00Z' }).to).toBeNull();
    expect(() =>
      buildHistoryFilter({
        from: '2026-11-06T00:00:00Z',
        to: '2026-11-06T00:00:00Z',
      }),
    ).not.toThrow();
  });

  it('rejects an inverted period', () => {
    expect(() =>
      buildHistoryFilter({
        from: '2026-11-09T00:00:00Z',
        to: '2026-11-06T00:00:00Z',
      }),
    ).toThrow(BusinessValidationException);
  });
});

describe('toLikePattern', () => {
  it('wraps the term and escapes LIKE wildcards', () => {
    expect(toLikePattern('abc')).toBe('%abc%');
    expect(toLikePattern('50%_a\\b')).toBe('%50\\%\\_a\\\\b%');
  });
});
