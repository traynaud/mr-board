# Rapport QA — US-017 Colonne « Statut »

## 1. Vérification des specs

`docs/features/README.md` (règles transverses RG-G01→RG-G19) et `docs/features/US-017-colonne-statut/specs.md` lus
intégralement. Maquettes de `docs/design/` consultées : la colonne « Statut » et sa case de menu **n'existent pas**
dans le prototype/wireframes (écart documenté dans les specs §4 et dans `docs/tech/US-017-colonne-statut/design.md`),
conçues par extrapolation des patterns existants (coche « Approved », menu « Colonnes », infobulle « +N »).

## 2. Tests automatisés

```
Backend  : rtk npm test                             → 399 passed, 0 failed
           rtk npm run test:e2e                      → 100 passed, 0 failed
           rtk npm run test:cov                       → 99.31 % lignes / 89.16 % branches / 98.57 % fonctions
                                                          (seuil 80 % respecté ; compute-merge-status.ts à 100 %
                                                          lignes/fonctions/branches)
           rtk npm run build                          → OK

Frontend : rtk npx tsc --noEmit                       → OK
           rtk npm run lint (ng lint)                 → OK
           rtk npx ng test --no-watch --coverage      → 555 passed, 0 failed
                                                          99.08 % statements / 95.03 % branches / 91.37 % méthodes
           rtk npm run build                           → OK
```

### Traçabilité critères d'acceptation → tests (16/16 validés)

| # | Scénario Gherkin | Statut | Test(s) |
|---|---|---|---|
| 1 | MR fusionnable | ✅ | `compute-merge-status.spec.ts::should_report_mergeable_when_gitlab_reports_mergeable_and_nothing_blocks` |
| 2 | MR bloquée pour plusieurs raisons | ✅ | `compute-merge-status.spec.ts::should_report_multiple_reasons_in_the_rg_017_04_order_without_duplicates` ; `merge-requests.e2e-spec.ts::should_report_a_blocked_merge_status_with_ordered_reasons` |
| 3 | Pipeline en échec sur un projet qui ne l'exige pas | ✅ | `compute-merge-status.spec.ts::should_report_pipeline_failed_regardless_of_the_project_ci_requirement` |
| 4 | Pipeline en cours | ✅ | `compute-merge-status.spec.ts::should_report_pipeline_running_from_ci_still_running_alone` |
| 5 | Discussions non résolues comptées | ✅ | `compute-merge-status.spec.ts::should_report_discussions_unresolved_with_the_remaining_count` |
| 6 | Statut indéterminé | ✅ | `compute-merge-status.spec.ts::should_report_unknown_when_gitlab_is_still_checking` ; e2e `should_report_an_unknown_merge_status_while_gitlab_is_still_checking` |
| 7 | Draft avec conflits | ✅ | `compute-merge-status.spec.ts::drafts > should_report_blocked_with_the_conflicts_reason_for_a_draft_with_conflicts` ; e2e `should_report_blocked_with_a_single_reason_for_a_draft_with_conflicts` |
| 8 | Draft sans signal bloquant | ✅ | `compute-merge-status.spec.ts::drafts > should_report_unknown_for_a_draft_with_no_blocking_signal` |
| 9 | Valeur inconnue de GitLab | ✅ | `compute-merge-status.spec.ts::should_report_other_for_an_unrecognised_future_gitlab_status` |
| 10 | MR synchronisée avant la mise à jour | ✅ | `merge-requests.service.spec.ts::should_report_an_unknown_merge_status_for_a_merge_request_synced_before_this_us` |
| 11 | Masquer la colonne | ✅ | `mr-table.component.spec.ts::should_show_the_status_column_by_default_and_hide_it_when_showStatus_is_false` ; `board-page.component.spec.ts::should_toggle_the_status_column_from_the_mr_table_menu_output` |
| 12 | Afficher Ouverte en gardant Statut | ✅ | `query-params.mapper.spec.ts::should_encode_cols_as_status_opened_when_both_are_visible` ; `board-page.component.spec.ts::should_toggle_the_opened_column_from_the_mr_table_menu_output` |
| 13 | Restauration depuis l'URL | ✅ | `query-params.mapper.spec.ts::should_decode_cols_opened_as_status_hidden_and_opened_visible` ; `board-page.component.spec.ts::should_restore_drafts_mine_filters_sort_and_columns_from_the_url_before_the_first_load` |
| 14 | URL sans cols | ✅ | `query-params.mapper.spec.ts::should_decode_absent_cols_as_the_default_optional_columns` / `should_omit_cols_for_the_default_state...` |
| 15 | Contrat API | ✅ | `merge-requests.e2e-spec.ts::should_expose_only_the_fields_in_scope_of_this_us` (forme exacte, pas de texte traduit) |
| 16 | Volume d'appels GitLab inchangé | ✅ | Satisfait par construction (un seul champ de requête GraphQL étendu, pas de requête supplémentaire) ; non régressé (suites `gitlab-client.service.spec.ts` / `sync.service.spec.ts` inchangées et vertes) |

## 3. Tests API manuels

Backend lancé localement (`DB_PATH=:memory:`, sans jeton GitLab configuré — comportement à vide) :

| Requête | Résultat attendu | Résultat observé |
|---|---|---|
| `GET /api/v1/merge-requests` (base vide) | 200, `{mergeRequests: [], warnings: []}` | ✅ Conforme |
| `GET /api/v1/merge-requests/facets` (base vide) | 200, facettes à 0 | ✅ Conforme |
| `GET /api/v1/merge-requests?sort=title:asc` | 400 (valeur de tri invalide) | ✅ `400` |
| `GET /api/v1/settings` | jeton jamais en clair | ✅ `tokenConfigured:false`, `tokenHint:null`, aucune chaîne de jeton |

⚠️ **Limite** : aucune instance GitLab réelle disponible dans cet environnement pour vérifier une synchronisation
complète avec des données de mergeabilité réelles (`detailedMergeStatus`, pipeline, etc.). Ce chemin est couvert par
les tests e2e avec `GitlabClientService` mocké (`test/merge-requests.e2e-spec.ts`, describe `mergeStatus (US-017)`),
seule stratégie possible dans ce projet (GitLab est systématiquement mocké, `docs/tech/testing.md` §1).

## 4. Vérification UI contre les maquettes

Pas de session navigateur interactive dans cette passe QA (évaluation par lecture de code + tests par harnesses
Material, cohérente avec la stratégie de test du projet, `docs/tech/testing.md` §3). Points vérifiés par lecture :

- Icône Lucide cerclée (`circle-check`/`circle-x`/`circle-dashed`), couleurs `--color-success`/`--color-danger`/
  `--color-neutral-600` — conforme au design system.
- Colonne positionnée entre « Approved » et « Depuis Ready », largeur initiale 64 px, non triable — conforme
  RG-017-07.
- Menu « Colonnes » : case « Statut » avant « Date d'ouverture », cochée par défaut — conforme RG-017-09.
- Infobulle multi-lignes (délai 300 ms), `aria-label` posé sur l'icône, focus clavier (`tabindex="0"`) — conforme
  RG-017-08.

## 5. Anomalies trouvées pendant cette passe QA/revue croisée

| # | Description | Sévérité | Statut |
|---|---|---|---|
| BUG-001 | L'icône de la colonne Statut n'avait ni taille (18 px) ni épaisseur de trait (2.2) explicites — elle héritait de la taille par défaut de Material (24 px) et du trait global (2), au lieu de RG-017-07/`design.md`. | Mineure (visuel) | ✅ Corrigée pendant cette passe (`merge-status-icon.component.scss`) |
| BUG-002 | `docs/tech/US-017-colonne-statut/archi.md` n'avait identifié qu'un seul appelant de `encodeQueryParams`/`UrlState` (`board-page.component.ts`) ; `settings-page.component.ts` (`boardQueryParams`) en est un second, non anticipé dans l'analyse d'impact initiale. | Mineure (doc) | ✅ Le code était déjà correct (détecté et corrigé par `tsc`/`ng test` pendant le dev) ; `archi.md` mis à jour a posteriori |
| BUG-003 | Le README (`docs/features/README.md`) n'avait pas été mis à jour au-delà de la case ✅ de la roadmap : glossaire (§3) sans le terme « Statut », §4.1 sans la colonne, §1/§9 encore formulés comme si le suivi de pipeline était hors périmètre, §10 listant encore US-017 comme « proposition non validée ». | Mineure (doc) | ✅ Corrigée pendant cette passe |

Aucune anomalie fonctionnelle ou de régression détectée dans le code de production.

## 6. Recommandations

- Une vérification visuelle en navigateur (taille/alignement réels de l'icône, rendu du tooltip multi-lignes) reste
  recommandée avant mise en production, en complément de cette revue par le code.
- Conserver le réflexe « rechercher tous les appelants d'un type partagé (`UrlState`) » lors de la phase Architecte
  d'une future US touchant `query-params.mapper.ts` (cf. BUG-002).

## 7. Verdict

✅ **US-017 validée** — 16/16 critères d'acceptation couverts, aucune anomalie fonctionnelle, 3 anomalies mineures
(2 documentaires, 1 visuelle) trouvées et corrigées pendant cette passe.
