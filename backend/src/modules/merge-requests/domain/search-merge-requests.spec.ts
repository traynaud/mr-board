import {
  compileSearch,
  matchesCompiledSearch,
  matchesSearch,
  searchMergeRequests,
} from './search-merge-requests.js';

function mr(overrides: Partial<{ title: string; iid: number }> = {}) {
  return { title: 'Refonte de la facturation', iid: 7, ...overrides };
}

describe('matchesSearch', () => {
  it('should_match_when_the_title_contains_the_single_term', () => {
    expect(matchesSearch(mr(), 'facturation')).toBe(true);
  });

  it('should_not_match_when_the_title_does_not_contain_the_term', () => {
    expect(matchesSearch(mr(), 'export')).toBe(false);
  });

  it('should_match_multiple_terms_regardless_of_order_rg_026_03', () => {
    expect(matchesSearch(mr(), 'fact refonte')).toBe(true);
  });

  it('should_require_every_term_to_be_present_and', () => {
    expect(matchesSearch(mr(), 'facturation export')).toBe(false);
  });

  it('should_collapse_repeated_internal_whitespace_rg_026_08', () => {
    expect(matchesSearch(mr(), 'fact    refonte')).toBe(true);
  });

  it('should_be_case_insensitive_rg_026_04', () => {
    expect(
      matchesSearch(
        mr({ title: 'Réfacto du module Paiement' }),
        'REFACTO paiement',
      ),
    ).toBe(true);
  });

  it('should_be_accent_insensitive_rg_026_04', () => {
    expect(
      matchesSearch(mr({ title: 'Réfacto du module Paiement' }), 'refacto'),
    ).toBe(true);
  });

  it('should_match_accented_query_against_unaccented_title', () => {
    expect(
      matchesSearch(mr({ title: 'Facturation generale' }), 'générale'),
    ).toBe(true);
  });

  it('should_match_everything_for_a_blank_query_rg_026_08', () => {
    expect(matchesSearch(mr(), '')).toBe(true);
    expect(matchesSearch(mr(), '   ')).toBe(true);
  });

  it('should_trim_leading_and_trailing_whitespace', () => {
    expect(matchesSearch(mr(), '  facturation  ')).toBe(true);
  });

  it.each(['!7', '#7', '7'])(
    'should_match_by_iid_with_query_%s_rg_026_05',
    (query) => {
      expect(
        matchesSearch(mr({ iid: 7, title: 'Correctif export CSV' }), query),
      ).toBe(true);
    },
  );

  it('should_not_match_a_different_iid', () => {
    expect(
      matchesSearch(mr({ iid: 7, title: 'Correctif export CSV' }), '!8'),
    ).toBe(false);
  });

  it('should_still_match_a_numeric_query_against_the_title_even_without_iid_equality', () => {
    // RG-026-05 : OU avec la correspondance de titre — "42" dans le titre reste retenu.
    expect(
      matchesSearch(mr({ iid: 99, title: 'Version 42 du connecteur' }), '42'),
    ).toBe(true);
  });

  it('should_treat_special_characters_as_plain_text_rg_026_03', () => {
    expect(matchesSearch(mr({ title: 'Fix (regex) [bug]' }), '(regex)')).toBe(
      true,
    );
  });
});

describe('compileSearch / matchesCompiledSearch', () => {
  it('should_produce_the_same_result_as_matchesSearch_for_a_title_query', () => {
    const compiled = compileSearch('fact refonte');
    expect(matchesCompiledSearch(mr(), compiled)).toBe(true);
    expect(
      matchesCompiledSearch(mr({ title: 'Correctif export CSV' }), compiled),
    ).toBe(false);
  });

  it('should_produce_the_same_result_as_matchesSearch_for_an_iid_query', () => {
    const compiled = compileSearch('!7');
    expect(
      matchesCompiledSearch(
        mr({ iid: 7, title: 'Correctif export CSV' }),
        compiled,
      ),
    ).toBe(true);
    expect(
      matchesCompiledSearch(
        mr({ iid: 8, title: 'Correctif export CSV' }),
        compiled,
      ),
    ).toBe(false);
  });

  it('should_compile_a_blank_query_to_no_terms_and_no_iid', () => {
    expect(compileSearch('   ')).toEqual({ terms: [], iidQuery: null });
  });

  it('should_be_reusable_across_several_merge_requests_without_recompiling', () => {
    const compiled = compileSearch('facturation');
    const items = [
      mr({ iid: 1, title: 'Refonte de la facturation' }),
      mr({ iid: 2, title: 'Correctif export CSV' }),
    ];

    expect(items.map((item) => matchesCompiledSearch(item, compiled))).toEqual([
      true,
      false,
    ]);
  });
});

describe('searchMergeRequests', () => {
  it('should_return_all_items_unchanged_for_a_blank_query', () => {
    const items = [mr({ iid: 1 }), mr({ iid: 2, title: 'Autre chose' })];

    expect(searchMergeRequests(items, '')).toBe(items);
  });

  it('should_filter_items_matching_the_query', () => {
    const items = [
      mr({ iid: 1, title: 'Refonte de la facturation' }),
      mr({ iid: 2, title: 'Correctif export CSV' }),
    ];

    expect(searchMergeRequests(items, 'facturation')).toEqual([
      { iid: 1, title: 'Refonte de la facturation' },
    ]);
  });

  it('should_return_an_empty_array_when_nothing_matches', () => {
    const items = [mr()];

    expect(searchMergeRequests(items, 'zzzzz')).toEqual([]);
  });
});
