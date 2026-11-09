import { HistoryEvent } from '../../models/history.model';
import { groupByDay, localDayOf } from './group-by-day';

function at(id: number, local: string): HistoryEvent {
  return {
    id,
    occurredAt: new Date(local).toISOString(),
    type: 'approved',
    status: 'confirmed',
    projectId: 1,
    projectAlias: 'api',
    mrIid: id,
    mrTitle: 'MR',
    mrWebUrl: 'https://x',
    actor: null,
    oldValue: null,
    newValue: null,
  };
}

describe('groupByDay', () => {
  it('should_group_consecutive_events_by_local_day_keeping_order', () => {
    const groups = groupByDay([
      at(4, '2026-11-09T18:00:00'),
      at(3, '2026-11-09T08:00:00'),
      at(2, '2026-11-08T23:59:00'),
      at(1, '2026-11-01T00:00:00'),
    ]);
    expect(groups.map((g) => [g.day, g.events.map((e) => e.id)])).toEqual([
      ['2026-11-09', [4, 3]],
      ['2026-11-08', [2]],
      ['2026-11-01', [1]],
    ]);
  });

  it('should_return_no_group_for_no_event', () => {
    expect(groupByDay([])).toEqual([]);
  });

  it('should_fallback_on_unparsable_date', () => {
    expect(localDayOf('2026-11-09-bad')).toBe('2026-11-09');
  });
});
