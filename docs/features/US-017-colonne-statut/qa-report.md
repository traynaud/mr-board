# Rapport QA — US-017 Colonne « Statut »

## Méthode

Vérification de la couverture de chaque scénario Gherkin de `specs.md` §5 par au moins un test automatisé, puis
exécution complète des suites backend et frontend.

## Traçabilité scénarios → tests

| Scénario Gherkin | Test(s) |
|---|---|
| MR fusionnable | `compute-merge-status.spec.ts::should_report_mergeable_when_gitlab_reports_mergeable_and_nothing_blocks` |
| MR bloquée pour plusieurs raisons | `compute-merge-status.spec.ts::should_report_multiple_reasons_in_the_rg_017_04_order_without_duplicates` ; `merge-requests.e2e-spec.ts::should_report_a_blocked_merge_status_with_ordered_reasons` |
| Pipeline en échec sur un projet qui ne l'exige pas | `compute-merge-status.spec.ts::should_report_pipeline_failed_regardless_of_the_project_ci_requirement` |
| Pipeline en cours | `compute-merge-status.spec.ts::should_report_pipeline_running_from_ci_still_running_alone` |
| Discussions non résolues comptées | `compute-merge-status.spec.ts::should_report_discussions_unresolved_with_the_remaining_count` |
| Statut indéterminé | `compute-merge-status.spec.ts::should_report_unknown_when_gitlab_is_still_checking` ; `merge-requests.e2e-spec.ts::should_report_an_unknown_merge_status_while_gitlab_is_still_checking` |
| Draft avec conflits | `compute-merge-status.spec.ts::drafts > should_report_blocked_with_the_conflicts_reason_for_a_draft_with_conflicts` ; `merge-requests.e2e-spec.ts::should_report_blocked_with_a_single_reason_for_a_draft_with_conflicts` |
| Draft sans signal bloquant | `compute-merge-status.spec.ts::drafts > should_report_unknown_for_a_draft_with_no_blocking_signal` |
| Valeur inconnue de GitLab | `compute-merge-status.spec.ts::should_report_other_for_an_unrecognised_future_gitlab_status` |
| MR synchronisée avant la mise à jour | `merge-requests.service.spec.ts::should_report_an_unknown_merge_status_for_a_merge_request_synced_before_this_us` |
| Masquer la colonne | `mr-table.component.spec.ts::should_show_the_status_column_by_default_and_hide_it_when_showStatus_is_false` ; `board-page.component.spec.ts::should_toggle_the_status_column_from_the_mr_table_menu_output` |
| Afficher Ouverte en gardant Statut | `query-params.mapper.spec.ts::should_encode_cols_as_status_opened_when_both_are_visible` ; `board-page.component.spec.ts::should_toggle_the_opened_column_from_the_mr_table_menu_output` |
| Restauration depuis l'URL | `query-params.mapper.spec.ts::should_decode_cols_opened_as_status_hidden_and_opened_visible` ; `board-page.component.spec.ts::should_restore_drafts_mine_filters_sort_and_columns_from_the_url_before_the_first_load` |
| URL sans cols | `query-params.mapper.spec.ts::should_decode_absent_cols_as_the_default_optional_columns` / `should_omit_cols_for_the_default_state_of_status_visible_and_opened_hidden` |
| Contrat API | `merge-requests.e2e-spec.ts::should_expose_only_the_fields_in_scope_of_this_us` (forme de `mergeStatus`, pas de texte traduit) |
| Volume d'appels GitLab inchangé | Satisfait par construction (aucun nouveau champ de requête GraphQL séparé, un seul appel paginé par projet) ; non régressé — suite `gitlab-client.service.spec.ts` et `sync.service.spec.ts` inchangées et vertes |

Tous les scénarios sont couverts.

## Vérifications complémentaires

- **RG-017-01** : requête GraphQL étendue (`detailedMergeStatus`, `conflicts`, `headPipeline { status }`,
  `approvalsRequired`, `approvalsLeft`, `resolvableDiscussionsCount`, `resolvedDiscussionsCount`), persistées dans 7
  colonnes nullables — vérifié par lecture du diff et par les tests du mapper/service.
- **RG-017-02** : `computeMergeStatus` est une fonction pure sans dépendance NestJS, testée isolément.
- **RG-017-05** (drafts) : le flag `draft` lui-même n'entre dans aucune condition de `computeMergeStatus` — vérifié
  par lecture du code (seul `detailedMergeStatus`/`conflicts`/`headPipelineStatus`/`approvalsLeft`/discussions sont
  utilisés).
- **RG-017-06** : `mergeStatus.reasons[].code` ne contient jamais de texte traduit — vérifié par le test e2e de forme
  exacte et par absence de toute chaîne de libellé dans le DTO backend.
- **RG-017-07** : colonne positionnée entre « Approved » et « Depuis Ready », largeur 64 px, non triable (aucun
  `sortChange` câblé sur l'en-tête `status`) — vérifié par lecture du template et des tests d'en-têtes.
- **RG-017-09** : ordre des cases du menu (Statut avant Ouverte), sémantique de `cols` (absent/`none`/liste) —
  couvert par `mr-table.component.spec.ts::should_list_the_status_option_before_the_opened_option` et la suite
  `query-params.mapper.spec.ts` (dont le round-trip sur les 4 combinaisons `showStatus`/`showOpened`).
- **RG-017-11** : aucune régression sur les MRs déjà en base (colonnes ajoutées nullables, aucun backfill dans la
  migration).

## Exécution des suites

```
Backend  : rtk npm run lint            → OK
           rtk npm test                → 401 passed, 0 failed
           rtk npm run test:e2e        → 103 passed, 0 failed
           rtk npm run test:cov        → 99.31 % lignes (seuil 80 %)
           rtk npm run build           → OK

Frontend : rtk npx tsc --noEmit        → OK
           rtk npm run lint            → OK
           rtk npx ng test --no-watch --coverage → 555 passed, 0 failed ; 99.08 % statements
           rtk npm run build           → OK
```

## Anomalies constatées

Aucune.

## Verdict

✅ US-017 validée — prête pour revue de code.
