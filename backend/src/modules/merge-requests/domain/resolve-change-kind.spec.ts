import { resolveChangeKind } from './resolve-change-kind.js';

describe('resolveChangeKind', () => {
  it('should_return_null_without_unseen_event', () => {
    expect(resolveChangeKind([])).toBeNull();
  });

  it('should_return_new_when_a_created_event_is_unseen', () => {
    expect(resolveChangeKind(['created'])).toBe('new');
  });

  it('should_prefer_new_over_later_modifications', () => {
    expect(resolveChangeKind(['approved', 'created', 'commented'])).toBe('new');
  });

  it.each(['title_changed', 'approved', 'commented', 'label_added'])(
    'should_return_modified_for_%s',
    (type) => {
      expect(resolveChangeKind([type, type])).toBe('modified');
    },
  );
});
