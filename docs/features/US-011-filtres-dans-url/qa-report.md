# Rapport QA — US-011 Filtres, tri et colonnes propagés dans l'URL

## 1. Tests automatisés

| Suite | Résultat |
|-------|----------|
| Backend unit (`npm test`) | 291 passed / 0 failed (inchangé — US purement frontend) |
| Backend e2e (`npm run test:e2e`) | 75 passed / 0 failed (inchangé) |
| Frontend (`ng test --no-watch --coverage`) | 372 passed / 0 failed |
| Frontend couverture | 97,96 % statements / 94,36 % branches / 94,9 % fonctions / 98,94 % lignes — seuil 80 % respecté |

`tsc --noEmit`, `ng lint`, `ng build` (frontend) et `npm run lint`/`npm run build` (backend) : tous verts.

## 2. Couverture des critères d'acceptation (specs.md §5)

| Scénario Gherkin | Statut | Test(s) couvrant |
|---|---|---|
| URL complétée par défaut | ✅ | `board-page.component.spec.ts` (`should_write_the_url_with_default_params_and_replaceUrl_on_the_very_first_load` — espion posé avant toute création de composant, capture l'appel initial) |
| Restauration depuis l'URL | ✅ | `board-page.component.spec.ts` (`should_restore_drafts_mine_filters_sort_and_columns_from_the_url_before_the_first_load` — vérifie les query params envoyés à l'API après restauration, `active`, `project`, `showOpened`) |
| Mise à jour de l'URL à chaque changement | ✅ | `should_write_the_url_without_pushing_history_when_a_filter_changes` (vérifie `replaceUrl: true`) |
| Filtre actif sans valeur | ✅ | `query-params.mapper.spec.ts` (`should_activate_a_list_filter_present_but_empty`, `should_encode_an_active_but_empty_list_filter_as_an_empty_string`, `should_activate_a_boolean_filter_with_an_invalid_value_but_leave_it_unset`) + round-trip |
| Valeur invalide | ✅ | `query-params.mapper.spec.ts` (`should_default_the_sort_when_the_key_is_invalid`, `..._when_the_direction_is_invalid`, `should_activate_a_boolean_filter_with_an_invalid_value_but_leave_it_unset`) |
| Aller-retour Paramètres | ✅ | `settings-page.component.spec.ts` (`should_navigate_to_the_board_with_its_current_filters_on_cancel`, `should_bind_the_current_board_query_params_to_the_back_link`) |
| Alias renommé | ✅ | `board-page.component.spec.ts` (`should_prune_a_renamed_project_alias_from_both_the_selection_and_the_rewritten_url` — restauration `project=api` → facets sans `api` → `FiltersStore.project()` vidé et URL réécrite en `project=`, bout en bout) |
| Pied de page | ✅ | `should_show_the_current_query_string_in_the_footer` (format littéral vérifié : `?drafts=0&mine=0&sort=ready:asc`, sans encodage `%3A`) |
| Mapper pur | ✅ | `query-params.mapper.spec.ts`, describe `round-trip (RG-011-08)`, 8 cas |
| Afficher la colonne Date d'ouverture | ✅ | `mr-table.component.spec.ts` (menu Colonnes, checkbox, reste ouvert) + `board-page.component.spec.ts` (`should_toggle_the_opened_column_from_the_mr_table_menu_output`) |

**10/10 scénarios pleinement validés.** Les 2 lacunes signalées en première passe (« URL complétée par défaut »,
« Alias renommé ») ont été comblées par 2 nouveaux tests d'intégration dans `board-page.component.spec.ts` — suite
frontend passée de 372 à 374 tests, toujours 0 échec.

## 3. Tests API manuels

Sans objet pour cette US : aucun endpoint backend nouveau ou modifié (tous les query params `drafts`/`mine`/
`project`/`author`/`assigned`/`approved`/`commented`/`sort` existaient déjà et ont été vérifiés manuellement lors
du QA de US-010). US-011 est une US purement frontend (état ↔ URL du navigateur).

## 4. Vérification UI contre les maquettes

⚠️ **Non réalisée visuellement**, comme pour US-010 : aucun outil de navigateur disponible dans cette session pour
comparer `ng serve` aux maquettes (positionnement du pied de page avec `margin-top: auto`, rendu du menu
« Colonnes », alignement de la colonne « Ouverte »). Conformité structurelle vérifiée par les tests de composants
uniquement. À vérifier manuellement avant mise en production.

## 5. Bugs trouvés

Aucun bug bloquant. Aucun `BUG-XXX` à consigner.

## 6. Recommandations

- ~~Scénario « URL complétée par défaut » sans test dédié~~ — comblé (`should_write_the_url_with_default_params_and_replaceUrl_on_the_very_first_load`).
- ~~Scénario « Alias renommé » sans test de bout en bout~~ — comblé (`should_prune_a_renamed_project_alias_from_both_the_selection_and_the_rewritten_url`).
- Reprend la recommandation déjà faite en US-010 : vérification visuelle manuelle en navigateur avant mise en
  production (pied de page, menu Colonnes) — toujours non réalisable dans cette session (pas d'outil de rendu).
