import { DEFAULT_SORT } from '../../models/merge-request.model';
import { UrlState, decodeQueryParams, encodeQueryParams, normalizeParams } from './query-params.mapper';

const DEFAULT_STATE: UrlState = {
  drafts: false,
  mine: false,
  active: [],
  project: [],
  author: [],
  assigned: [],
  approved: null,
  commented: null,
  sort: DEFAULT_SORT,
  showStatus: true,
  showOpened: false,
};

describe('normalizeParams', () => {
  it('should_keep_string_values_as_is', () => {
    expect(normalizeParams({ drafts: '1', project: 'api' })).toEqual({ drafts: '1', project: 'api' });
  });

  it('should_keep_only_the_first_value_of_a_repeated_query_param', () => {
    expect(normalizeParams({ drafts: ['1', '2'] })).toEqual({ drafts: '1' });
  });

  it('should_drop_a_value_that_is_neither_a_string_nor_a_string_array', () => {
    expect(normalizeParams({ drafts: 42, project: [], other: null })).toEqual({});
  });
});

describe('decodeQueryParams', () => {
  it('should_return_the_default_state_for_an_empty_query', () => {
    expect(decodeQueryParams({})).toEqual(DEFAULT_STATE);
  });

  it('should_decode_drafts_and_mine_as_1_only', () => {
    expect(decodeQueryParams({ drafts: '1', mine: '1' })).toMatchObject({ drafts: true, mine: true });
    expect(decodeQueryParams({ drafts: '0', mine: 'x' })).toMatchObject({ drafts: false, mine: false });
  });

  it('should_activate_a_list_filter_present_with_values', () => {
    const state = decodeQueryParams({ project: 'api,web' });
    expect(state.active).toEqual(['project']);
    expect(state.project).toEqual(['api', 'web']);
  });

  it('should_activate_a_list_filter_present_but_empty', () => {
    const state = decodeQueryParams({ author: '' });
    expect(state.active).toEqual(['author']);
    expect(state.author).toEqual([]);
  });

  it('should_leave_a_list_filter_inactive_when_absent', () => {
    const state = decodeQueryParams({});
    expect(state.active).not.toContain('project');
    expect(state.project).toEqual([]);
  });

  it('should_not_validate_unknown_list_values_locally', () => {
    const state = decodeQueryParams({ project: 'inconnu' });
    expect(state.project).toEqual(['inconnu']);
    expect(state.active).toEqual(['project']);
  });

  it('should_decode_a_valid_boolean_filter', () => {
    expect(decodeQueryParams({ approved: '1' })).toMatchObject({ approved: 'yes', active: ['approved'] });
    expect(decodeQueryParams({ commented: '0' })).toMatchObject({ commented: 'no', active: ['commented'] });
  });

  it('should_activate_a_boolean_filter_with_an_invalid_value_but_leave_it_unset', () => {
    const state = decodeQueryParams({ approved: 'maybe' });
    expect(state.active).toEqual(['approved']);
    expect(state.approved).toBeNull();
  });

  it('should_leave_a_boolean_filter_inactive_when_absent', () => {
    const state = decodeQueryParams({});
    expect(state.active).not.toContain('approved');
    expect(state.approved).toBeNull();
  });

  it('should_reconstruct_active_in_the_canonical_order_regardless_of_url_order', () => {
    const state = decodeQueryParams({ commented: '1', project: 'api', approved: '0', author: 'mdupont' });
    expect(state.active).toEqual(['project', 'author', 'approved', 'commented']);
  });

  it('should_decode_a_valid_sort', () => {
    expect(decodeQueryParams({ sort: 'diff:desc' })).toMatchObject({ sort: { key: 'diff', direction: 'desc' } });
  });

  it('should_default_the_sort_when_the_key_is_invalid', () => {
    expect(decodeQueryParams({ sort: 'title:asc' })).toMatchObject({ sort: DEFAULT_SORT });
  });

  it('should_default_the_sort_when_the_direction_is_invalid', () => {
    expect(decodeQueryParams({ sort: 'ready:foo' })).toMatchObject({ sort: DEFAULT_SORT });
  });

  it('should_default_the_sort_when_absent', () => {
    expect(decodeQueryParams({})).toMatchObject({ sort: DEFAULT_SORT });
  });

  it('should_decode_absent_cols_as_the_default_optional_columns', () => {
    // Scenario: URL sans cols
    expect(decodeQueryParams({})).toMatchObject({ showStatus: true, showOpened: false });
  });

  it('should_decode_cols_none_as_every_optional_column_hidden', () => {
    expect(decodeQueryParams({ cols: 'none' })).toMatchObject({
      showStatus: false,
      showOpened: false,
    });
  });

  it('should_decode_cols_opened_as_status_hidden_and_opened_visible', () => {
    // Scenario: Restauration depuis l'URL
    expect(decodeQueryParams({ cols: 'opened' })).toMatchObject({
      showStatus: false,
      showOpened: true,
    });
  });

  it('should_decode_cols_status_opened_as_both_visible', () => {
    expect(decodeQueryParams({ cols: 'status,opened' })).toMatchObject({
      showStatus: true,
      showOpened: true,
    });
  });

  it('should_ignore_an_unknown_token_in_cols', () => {
    expect(decodeQueryParams({ cols: 'foo,opened' })).toMatchObject({
      showStatus: false,
      showOpened: true,
    });
  });
});

describe('encodeQueryParams', () => {
  it('should_always_include_drafts_mine_and_sort', () => {
    expect(encodeQueryParams(DEFAULT_STATE)).toEqual({ drafts: '0', mine: '0', sort: 'ready:asc' });
  });

  it('should_encode_drafts_and_mine_as_1_when_true', () => {
    const params = encodeQueryParams({ ...DEFAULT_STATE, drafts: true, mine: true });
    expect(params['drafts']).toBe('1');
    expect(params['mine']).toBe('1');
  });

  it('should_encode_an_active_list_filter_as_csv', () => {
    const params = encodeQueryParams({ ...DEFAULT_STATE, active: ['project'], project: ['api', 'web'] });
    expect(params['project']).toBe('api,web');
  });

  it('should_encode_an_active_but_empty_list_filter_as_an_empty_string', () => {
    const params = encodeQueryParams({ ...DEFAULT_STATE, active: ['author'], author: [] });
    expect(params['author']).toBe('');
  });

  it('should_not_include_an_inactive_list_filter', () => {
    const params = encodeQueryParams({ ...DEFAULT_STATE, project: ['api'] });
    expect(params['project']).toBeUndefined();
  });

  it('should_encode_an_active_boolean_filter_value', () => {
    const params = encodeQueryParams({ ...DEFAULT_STATE, active: ['approved'], approved: 'yes' });
    expect(params['approved']).toBe('1');
  });

  it('should_encode_an_active_boolean_filter_without_a_value_as_an_empty_string', () => {
    const params = encodeQueryParams({ ...DEFAULT_STATE, active: ['commented'], commented: null });
    expect(params['commented']).toBe('');
  });

  it('should_encode_the_sort', () => {
    const params = encodeQueryParams({ ...DEFAULT_STATE, sort: { key: 'diff', direction: 'desc' } });
    expect(params['sort']).toBe('diff:desc');
  });

  it('should_omit_cols_for_the_default_state_of_status_visible_and_opened_hidden', () => {
    // Scenario: URL sans cols (état par défaut)
    expect(encodeQueryParams(DEFAULT_STATE)['cols']).toBeUndefined();
  });

  it('should_encode_cols_as_none_when_every_optional_column_is_hidden', () => {
    // Scenario: Masquer la colonne
    expect(
      encodeQueryParams({ ...DEFAULT_STATE, showStatus: false, showOpened: false })['cols'],
    ).toBe('none');
  });

  it('should_encode_cols_as_status_opened_when_both_are_visible', () => {
    // Scenario: Afficher Ouverte en gardant Statut
    expect(
      encodeQueryParams({ ...DEFAULT_STATE, showStatus: true, showOpened: true })['cols'],
    ).toBe('status,opened');
  });

  it('should_encode_cols_as_opened_when_only_opened_is_visible', () => {
    expect(
      encodeQueryParams({ ...DEFAULT_STATE, showStatus: false, showOpened: true })['cols'],
    ).toBe('opened');
  });

  it('should_produce_keys_in_the_canonical_order_of_rg_011_01', () => {
    const params = encodeQueryParams({
      ...DEFAULT_STATE,
      active: ['project', 'author', 'assigned', 'approved', 'commented'],
      project: ['api'],
      author: ['mdupont'],
      assigned: ['nobody'],
      approved: 'yes',
      commented: 'no',
      showStatus: true,
      showOpened: true,
    });
    expect(Object.keys(params)).toEqual([
      'drafts',
      'mine',
      'project',
      'author',
      'assigned',
      'approved',
      'commented',
      'sort',
      'cols',
    ]);
  });
});

describe('round-trip (RG-011-08)', () => {
  const CASES: UrlState[] = [
    DEFAULT_STATE,
    { ...DEFAULT_STATE, drafts: true, mine: true },
    { ...DEFAULT_STATE, active: ['project'], project: ['api', 'web'] },
    { ...DEFAULT_STATE, active: ['author'], author: [] },
    { ...DEFAULT_STATE, active: ['assigned'], assigned: ['nobody', 'mdupont'] },
    { ...DEFAULT_STATE, active: ['approved'], approved: 'yes' },
    { ...DEFAULT_STATE, active: ['commented'], commented: null },
    { ...DEFAULT_STATE, showStatus: false, showOpened: false },
    { ...DEFAULT_STATE, showStatus: false, showOpened: true },
    { ...DEFAULT_STATE, showStatus: true, showOpened: true },
    {
      ...DEFAULT_STATE,
      active: ['project', 'author', 'assigned', 'approved', 'commented'],
      project: ['api', 'web'],
      author: ['mdupont'],
      assigned: ['nobody'],
      approved: 'no',
      commented: 'yes',
      sort: { key: 'diff', direction: 'desc' },
      showStatus: true,
      showOpened: true,
    },
  ];

  it.each(CASES)('should_be_idempotent_for_%#', (state) => {
    const decoded = decodeQueryParams(encodeQueryParams(state));
    expect(decoded).toEqual(state);
  });
});
