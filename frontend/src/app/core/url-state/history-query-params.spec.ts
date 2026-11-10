import { EMPTY_HISTORY_FILTERS } from '../../models/history.model';
import {
  activeKeysOf,
  dateToDay,
  dayToDate,
  decodeHistoryQuery,
  encodeHistoryQuery,
  hasAnyHistoryFilter,
  isValidDay,
} from './history-query-params';

describe('history query params', () => {
  describe('decodeHistoryQuery', () => {
    it('should_return_empty_filters_without_params', () => {
      expect(decodeHistoryQuery({})).toEqual(EMPTY_HISTORY_FILTERS);
    });

    it('should_decode_every_filter', () => {
      expect(
        decodeHistoryQuery({
          q: 'login',
          type: 'merged,approved',
          actor: 'alice,none',
          project: '1,22',
          from: '2026-11-01',
          to: '2026-11-09',
        }),
      ).toEqual({
        search: 'login',
        types: ['merged', 'approved'],
        actors: ['alice', 'none'],
        projects: [1, 22],
        from: '2026-11-01',
        to: '2026-11-09',
      });
    });

    it('should_drop_unknown_types_bad_projects_and_bad_dates', () => {
      const filters = decodeHistoryQuery({
        type: 'merged,inconnu,',
        project: '1,abc,2.5',
        from: 'hier',
        to: '2026-13-45',
      });
      expect(filters.types).toEqual(['merged']);
      expect(filters.projects).toEqual([1]);
      expect(filters.from).toBeNull();
      expect(filters.to).toBeNull();
    });

    it('should_keep_only_the_first_value_of_a_repeated_key_and_cap_the_search', () => {
      expect(decodeHistoryQuery({ type: ['merged', 'closed'] }).types).toEqual(['merged']);
      expect(decodeHistoryQuery({ q: 'x'.repeat(150) }).search).toHaveLength(100);
      expect(decodeHistoryQuery({ q: 42 }).search).toBe('');
    });
  });

  describe('encodeHistoryQuery', () => {
    it('should_omit_empty_filters', () => {
      expect(encodeHistoryQuery(EMPTY_HISTORY_FILTERS)).toEqual({
        q: null,
        type: null,
        actor: null,
        project: null,
        from: null,
        to: null,
      });
      expect(encodeHistoryQuery({ ...EMPTY_HISTORY_FILTERS, search: '   ' })['q']).toBeNull();
    });

    it('should_join_lists_and_roundtrip', () => {
      const filters = {
        search: 'a b',
        types: ['merged' as const, 'closed' as const],
        actors: ['alice'],
        projects: [3, 4],
        from: '2026-11-01',
        to: null,
      };
      const encoded = encodeHistoryQuery(filters);
      expect(encoded['type']).toBe('merged,closed');
      expect(decodeHistoryQuery(Object.fromEntries(Object.entries(encoded).filter(([, v]) => v !== null)))).toEqual(
        filters,
      );
    });
  });

  describe('helpers', () => {
    it('should_validate_calendar_days', () => {
      expect(isValidDay('2026-02-28')).toBe(true);
      expect(isValidDay('2026-02-30')).toBe(false);
      expect(isValidDay('2026-2-3')).toBe(false);
    });

    it('should_detect_active_filters_and_pills', () => {
      expect(hasAnyHistoryFilter(EMPTY_HISTORY_FILTERS)).toBe(false);
      expect(hasAnyHistoryFilter({ ...EMPTY_HISTORY_FILTERS, search: ' ' })).toBe(false);
      expect(hasAnyHistoryFilter({ ...EMPTY_HISTORY_FILTERS, to: '2026-11-01' })).toBe(true);
      expect(
        activeKeysOf({ ...EMPTY_HISTORY_FILTERS, projects: [1], actors: ['a'], from: '2026-11-01' }),
      ).toEqual(['actor', 'project', 'period']);
    });

    it('should_convert_days_to_local_dates_and_back', () => {
      expect(dateToDay(dayToDate('2026-11-09'))).toBe('2026-11-09');
      expect(dayToDate('2026-11-09').getHours()).toBe(0);
    });
  });
});
