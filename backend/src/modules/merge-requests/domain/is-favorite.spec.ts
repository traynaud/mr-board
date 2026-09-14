import { favoriteKey, isFavorite } from './is-favorite';

describe('favoriteKey', () => {
  it('should_combine_project_id_and_iid_rg_027_04', () => {
    expect(favoriteKey({ projectId: 3, iid: 42 })).toBe('3:42');
  });

  it('should_produce_different_keys_for_the_same_iid_on_different_projects', () => {
    expect(favoriteKey({ projectId: 1, iid: 42 })).not.toBe(
      favoriteKey({ projectId: 2, iid: 42 }),
    );
  });
});

describe('isFavorite', () => {
  it('should_be_true_when_the_key_is_in_the_set_rg_027_01', () => {
    const favoriteKeys = new Set(['3:42']);

    expect(isFavorite({ projectId: 3, iid: 42 }, favoriteKeys)).toBe(true);
  });

  it('should_be_false_when_the_key_is_absent', () => {
    const favoriteKeys = new Set(['3:42']);

    expect(isFavorite({ projectId: 3, iid: 7 }, favoriteKeys)).toBe(false);
  });

  it('should_be_false_for_an_empty_set', () => {
    expect(isFavorite({ projectId: 3, iid: 42 }, new Set())).toBe(false);
  });
});
