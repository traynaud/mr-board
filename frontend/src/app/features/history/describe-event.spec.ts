import { HistoryEvent } from '../../models/history.model';
import { describeEvent, toneOf, valueText } from './describe-event';

function event(overrides: Partial<HistoryEvent>): HistoryEvent {
  return {
    id: 1,
    occurredAt: '2026-11-09T10:00:00.000Z',
    type: 'approved',
    status: 'confirmed',
    projectId: 1,
    projectAlias: 'api',
    mrIid: 1,
    mrTitle: 'MR',
    mrWebUrl: 'https://x/1',
    actor: null,
    oldValue: null,
    newValue: null,
    ...overrides,
  };
}

describe('describeEvent', () => {
  it('should_describe_title_change_with_old_and_new', () => {
    expect(describeEvent(event({ type: 'title_changed', oldValue: 'A', newValue: 'B' }))).toEqual({
      actionKey: 'history.actions.title_changed',
      params: {},
      detail: { kind: 'change', oldValue: 'A', newValue: 'B' },
    });
  });

  it('should_quote_comment_excerpt', () => {
    expect(describeEvent(event({ type: 'commented', newValue: 'LGTM' })).detail).toEqual({
      kind: 'quote',
      text: 'LGTM',
    });
  });

  it('should_have_no_detail_for_empty_comment', () => {
    expect(describeEvent(event({ type: 'commented' })).detail).toBeNull();
  });

  it('should_use_new_value_for_added_and_old_value_for_removed', () => {
    expect(describeEvent(event({ type: 'label_added', newValue: 'bug' })).params).toEqual({ value: 'bug' });
    expect(
      describeEvent(
        event({ type: 'reviewer_removed', oldValue: { username: 'jd', name: 'Jean Durand' } }),
      ).params,
    ).toEqual({ value: 'Jean Durand' });
  });

  it('should_have_plain_description_for_other_types', () => {
    expect(describeEvent(event({ type: 'merged' }))).toEqual({
      actionKey: 'history.actions.merged',
      params: {},
      detail: null,
    });
  });
});

describe('toneOf', () => {
  it.each([
    ['approved', 'success'],
    ['merged', 'success'],
    ['closed', 'accent'],
    ['deleted', 'accent'],
    ['disappeared', 'accent'],
    ['commented', 'neutral'],
    ['marked_draft', 'neutral'],
  ] as const)('should_map_%s_to_%s', (type, tone) => {
    expect(toneOf(type)).toBe(tone);
  });
});

describe('valueText', () => {
  it('should_fallback_to_username_when_name_is_empty', () => {
    expect(valueText({ username: 'jd', name: '' })).toBe('jd');
    expect(valueText(null)).toBe('');
    expect(valueText(true)).toBe('true');
  });
});
