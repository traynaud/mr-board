# Rapport QA — US-026 Recherche libre sur le titre des MRs

Testé le 2026-09-14.

## 1. Tests automatisés

| Suite | Résultat |
|-------|----------|
| Backend `npm test` | ✅ 593 passed / 0 failed (51 suites) — +4 en Phase 5 |
| Backend `npm run test:e2e` | ✅ 139 passed / 0 failed (7 suites) — +2 en Phase 5 |
| Backend `npm run test:cov` | ✅ 98.89 % stmts / 89.43 % branch / 98.04 % funcs / 98.97 % lines — seuil 80 % largement respecté ; `domain/search-merge-requests.ts` à 100 % sur les 4 métriques |
| Backend `npm run lint` / `npm run build` | ✅ |
| Frontend `npx tsc --noEmit` | ✅ |
| Frontend `npx ng test --no-watch --coverage` | ✅ 777 passed / 0 failed (66 suites) — +2 en Phase 5 |
| Frontend couverture globale | ✅ 96.58 % stmts / 94.73 % branch / 92.33 % funcs / 98.74 % lines |
| Frontend `npm run lint` / `npm run build` | ✅ |

**Note mineure de couverture** : `merge-requests.service.ts` reste à 100 % statements mais 87.34 % branch — la
seule branche non exercée est la valeur par défaut `search = ''` du paramètre de la méthode privée `loadBase()`
(jamais atteinte car `listOpen`/`getFacets` résolvent toujours `search` avant l'appel) ; comportement strictement
équivalent des deux côtés, sans impact.

## 2. Tests API manuels

**Non réalisés**, comme lors de la QA de US-025 — même choix reconduit pour éviter de risquer une nouvelle
collision avec un processus backend externe à cette session. Compensé par les 5 scénarios e2e dédiés
(`backend/test/merge-requests.e2e-spec.ts`) qui couvrent déjà : recherche simple, recherche par `!iid`,
combinaison avec un autre filtre, effet sur les facettes, et aucun résultat.

## 3. Vérification UI contre les maquettes

⚠️ **Non réalisée en direct** (extension Claude in Chrome toujours déconnectée dans cet environnement). Compensé
par une relecture du template et du SCSS : le champ reprend explicitement le style déjà validé de `.menu-search`
(`FilterPillComponent`, US-010) — `mat-form-field` `appearance="outline"`, aucun arrondi, même typographie — donc
un risque visuel résiduel très faible.

## 4. Critères d'acceptation (specs.md §5)

| Scénario | Statut |
|----------|--------|
| Filtrer sur un mot du titre | ✅ e2e `should_filter_by_a_title_search_case_and_accent_insensitively_rg_026` + unitaires |
| Multi-termes dans le désordre | ✅ `should_match_multiple_terms_regardless_of_order_rg_026_03` |
| Insensible casse/accents | ✅ `should_be_case_insensitive_rg_026_04`, `should_be_accent_insensitive_rg_026_04`, e2e |
| Recherche par numéro (`!42`) | ✅ `should_match_by_iid_with_query_%s_rg_026_05` (×3), e2e `..._rg_026_05` |
| Combinaison avec les autres filtres | ✅ e2e `should_combine_with_other_active_filters_with_and_rg_026_06` |
| Prise en compte dans les compteurs de facettes | ✅ service + e2e `should_scope_facet_counts_to_the_search_rg_026_07` |
| Aucun résultat | ✅ e2e `should_return_an_empty_list_when_nothing_matches` + page `..._rg_026_12` |
| Propagée dans l'URL et restaurée | ✅ round-trip `query-params.mapper.spec.ts` + page `should_restore_the_search_from_the_url..._rg_026_10` |
| Le bouton Effacer vide aussi la recherche | ✅ `should_clear_the_visible_search_field_when_the_clear_filters_button_is_clicked_rg_026_11` (ajouté en Phase 5) |
| Vider le champ seul ne touche pas aux autres filtres | ✅ `should_not_touch_other_active_filters_when_the_search_field_is_cleared_alone_rg_026_11` (ajouté en Phase 5) |
| S'applique aussi aux drafts affichés | ✅ `should_apply_the_search_to_displayed_drafts_too_rg_026_06` (e2e, ajouté en Phase 5) |

**11/11 scénarios validés avec test dédié de bout en bout.**

## 5. Bugs / anomalies trouvés

### BUG-002 (mineur) — « Effacer » et la croix du champ : pas de preuve de bout en bout — ✅ corrigé en Phase 5

2 tests ajoutés à `board-page.component.spec.ts`
(`should_clear_the_visible_search_field_when_the_clear_filters_button_is_clicked_rg_026_11`,
`should_not_touch_other_active_filters_when_the_search_field_is_cleared_alone_rg_026_11`) — suite complète
rejouée : 777 passed / 0 failed.

<details>
<summary>Détail original de la découverte (QA)</summary>

- **Constat** : `FiltersStore.clear()` remet bien `search` à `''` (`should_clear_the_search_along_with_mine_and_composable_filters_rg_026_11`,
  testé unitairement), et `FilterBarComponent` émet bien `searchChange` avec `''` quand on clique sa propre croix
  (`should_show_and_use_the_search_clear_button_without_touching_other_filters_rg_026_11`). Mais aucun test ne
  reliait les deux bouts : cliquer le bouton « Effacer » de `BoardPageComponent` (celui de la barre ou celui de
  l'état vide) et vérifier que le **champ de recherche affiché** est bien réinitialisé, ni que le déclenchement de
  la croix du champ seul laisse un **autre filtre actif** intact au niveau de la page.
- **Relecture de code** : `onClearFilters()` appelle `filtersStore.clear()` puis `mrStore.scheduleReload()` ; le
  template lie `[search]="filtersStore.search()"` de façon réactive — la logique était jugée correcte à la
  lecture, seulement non prouvée par un test d'intégration `BoardPageComponent`.
- **Impact** : aucun impact fonctionnel connu — trou de couverture sur deux critères d'acceptation explicites des
  specs.

</details>

### BUG-003 (mineur) — Recherche + Drafts : pas de test combiné — ✅ corrigé en Phase 5

2 tests e2e ajoutés (`should_not_reveal_a_hidden_draft_matching_the_search_rg_026_06`,
`should_apply_the_search_to_displayed_drafts_too_rg_026_06`) — suite e2e rejouée : 139 passed / 0 failed.

<details>
<summary>Détail original de la découverte (QA)</summary>

- **Constat** : aucun test (service, e2e ou frontend) n'exerçait `q=...` conjointement avec `drafts=1`. Le
  scénario Gherkin « La recherche s'applique aussi aux drafts affichés » n'avait donc pas de preuve directe.
- **Relecture de code** : `MergeRequestsService.loadBase()` récupère `allMergeRequests` avec
  `where: includeDrafts ? {} : { draft: false }` **avant** d'appliquer la recherche — celle-ci s'applique donc
  mécaniquement à l'ensemble récupéré, drafts compris dès que `includeDrafts` est vrai. Le code était jugé
  correct à la lecture, seulement non exercé par un test.
- **Impact** : aucun impact fonctionnel connu — trou de couverture sur un critère d'acceptation explicite.

</details>

### Suggestion (revue de code) — perf : normalisation de la recherche recalculée par MR — ✅ corrigée en Phase 5

`matchesSearch()` était appelé directement dans la boucle `.filter()` de `loadBase()`, recalculant le découpage en
termes et l'analyse de l'`iid` pour chaque MR alors que ce travail ne dépend que de `search`. Introduit
`compileSearch()`/`matchesCompiledSearch()` : la requête est désormais normalisée une seule fois par appel à
`loadBase()`, réutilisée pour toutes les MRs. 4 nouveaux tests unitaires (`compileSearch`/`matchesCompiledSearch`).

## 6. Recommandations

1. Vérification visuelle en direct dès que l'extension Claude in Chrome sera disponible (§3) — non bloquant.
2. QA API manuelle non réalisée cette fois-ci (§2), comme pour US-025 — même limitation d'environnement.
