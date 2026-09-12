# Rapport QA — US-004 Synchronisation des MRs depuis GitLab

## 1. Tests automatisés

| Suite | Résultat |
|---|---|
| Backend lint (`npm run lint`) | ✅ 0 erreur |
| Backend unitaires (`npm test`) | ✅ 184 passés / 184 |
| Backend e2e (`npm run test:e2e`) | ✅ 46 passés / 46 |
| Backend couverture (`npm run test:cov`) | ✅ 98,98 % statements / 85,15 % branches (seuil 80 %) |
| Frontend `tsc --noEmit` | ✅ 0 erreur |
| Frontend lint (`ng lint`) | ✅ 0 erreur |
| Frontend unitaires + couverture (`ng test --no-watch --coverage`) | ✅ 196 passés / 196 — 98,97 % statements / 94,85 % branches (seuil 80 %) |
| Frontend build (`ng build`) | ✅ succès |

Aucun fichier créé ou modifié par cette US n'est sous le seuil de 80 % (le plus bas, `board-toolbar.component.ts`, est à 93,75 % statements).

## 2. Couverture des critères d'acceptation (specs.md §6)

| # | Scénario | Statut | Test(s) |
|---|---|---|---|
| 1 | Synchronisation manuelle réussie sur plusieurs repos | ✅ | `sync.e2e-spec.ts::should_synchronise_every_active_project_successfully` |
| 2 | Upsert et suppression des MRs disparues | ✅ | `merge-requests.service.spec.ts` (`upsertForProject`, `deleteMissing`) |
| 3 | Reviewers et assignees multiples | ✅ | `merge-requests.service.spec.ts::should_upsert_each_reviewer_and_assignee...` |
| 4 | Calcul Ready à l'insertion, non draft | ✅ | `resolve-ready-at.spec.ts::should_use_gitlab_created_at_when_never_seen_and_not_draft` |
| 5 | Calcul Ready à l'insertion, draft | ✅ | `resolve-ready-at.spec.ts::should_return_null_when_never_seen_and_draft` |
| 6 | Passage de draft à ready | ✅ | `resolve-ready-at.spec.ts::should_use_now_when_transitioning_from_draft_to_non_draft` |
| 7 | Ready stable d'une synchronisation à l'autre | ✅ | `resolve-ready-at.spec.ts::should_keep_existing_ready_at_when_staying_non_draft` |
| 8 | Retour en draft | ✅ | `resolve-ready-at.spec.ts::should_return_null_when_transitioning_from_non_draft_to_draft` |
| 9 | Erreur sur un seul projet parmi plusieurs | ✅ | `sync.e2e-spec.ts::should_report_partial_when_one_project_fails_and_another_succeeds` |
| 10 | Jeton refusé sur tous les projets | ✅ | `sync.e2e-spec.ts::should_report_error_when_every_project_fails` + `board-page.component.spec.ts` (toast) |
| 11 | Synchronisation déjà en cours | ✅ | `sync.e2e-spec.ts::should_not_start_a_second_run_while_one_is_in_progress` + `sync.service.spec.ts` |
| 12 | Synchroniser un seul projet après son ajout | ✅ | `repositories-section.component.spec.ts` (flush `POST /sync?projectId=`) |
| 13 | Synchroniser après enregistrement des paramètres | ✅ | `settings-page.component.spec.ts` (flush `POST /sync`) |
| 14 | Bandeau sans jeton | ✅ | `board-page.component.spec.ts::should_show_the_no_token_banner...` |
| 15 | Aucun repo configuré | ✅ | `board-page.component.spec.ts::should_show_the_empty_state...` |
| 16 | Pagination GraphQL | ✅ | `gitlab-client.service.spec.ts::should_aggregate_every_page_following_the_cursor` |
| 17 | Rate limiting, nouvelle tentative réussie | ✅ | `gitlab-client.service.spec.ts::should_retry_once_after_a_429_and_succeed` |
| 18 | Rate limiting persistant | ✅ | `gitlab-client.service.spec.ts::should_fail_the_project_on_two_consecutive_429` |
| 19 | Dépassement du délai par projet | ✅ | `gitlab-client.service.spec.ts` (2 cas de timeout) + `sync.service.spec.ts::should_not_interrupt_other_projects_when_one_times_out` (ajouté en Phase 5, voir revue) |
| 20 | Statut relatif recalculé sans appel réseau | ✅ | `sync-status-label.spec.ts` (fonction pure, aucun mock réseau) |
| 21 | Jamais synchronisé | ✅ | `sync.e2e-spec.ts::should_report_never_synced_initially` + `board-toolbar.component.spec.ts` |

**21/21 scénarios validés.**

## 3. Tests API manuels

Backend lancé en local (`APP_SECRET`, `DB_PATH=:memory:`), testé via `curl` :

| Vérification | Résultat |
|---|---|
| `GET /api/v1/sync/status` à froid → `{running:false, lastRun:null, nextRunAt:null}` | ✅ |
| `PUT /api/v1/settings` avec jeton → `GET /api/v1/settings` ne renvoie jamais le jeton en clair (`tokenHint` uniquement) | ✅ |
| `POST /api/v1/sync` sans aucun repo configuré → 202 `{running:true}`, puis `lastRun.status = "success"`, `mrCount: 0` (aucun appel GitLab) | ✅ |
| `POST /api/v1/sync?projectId=999` (inconnu) → 404, `code: "entity.notFound"` | ✅ |
| `POST /api/v1/sync?projectId=abc` (non numérique) → 400 (validation `ParseIntPipe`) | ✅ |
| `POST /api/v1/projects` avec un jeton invalide contre la vraie instance `gitlab.com` → 400 `projects.notFound`, message ne contenant pas le jeton | ✅ (confirme le round-trip réseau réel, comportement hérité d'US-003, non régressé) |

**Limite de ce passage manuel** : sans jeton GitLab valide, il n'a pas été possible d'ajouter un vrai repo et donc d'observer manuellement `running: true` pendant un appel GraphQL réellement en vol, ni une réponse 401/429 réelle de GitLab. Ces chemins sont exclusivement couverts par les tests automatisés (`GitlabClientService` mocké en e2e, `fetch` mocké en unitaire) — couverture jugée suffisante étant donné l'absence d'identifiants de test dans cet environnement.

## 4. Conformité aux maquettes (`docs/design/`, `design.md`)

Vérification par lecture de code (pas d'accès navigateur dans cet environnement — voir dev-report.md) :

| Point | Statut |
|---|---|
| Icônes Lucide déjà enregistrées réutilisées (`refresh-cw`, `alert-circle`), aucune nouvelle icône | ✅ |
| Aucune couleur ni `border-radius` en dur dans les nouveaux fichiers SCSS (`board-page`, `board-toolbar`) | ✅ (vérifié par recherche statique) |
| Tokens couleur conformes (`--color-accent-700/800/100`, `--color-neutral-600`, `--color-divider`) | ✅ |
| Barre de progression 2 px sous la toolbar, texte de statut en position "entre la marque et le bouton Rafraîchir" (conforme wireframes 1a/1b) | ✅ (structure DOM vérifiée par les tests de `BoardToolbarComponent`) |
| Bandeau accent-100/accent-800 avec bouton "Configurer" (conforme prototype) | ✅ |
| État vide "Aucun repo configuré" (pas de maquette de référence directe, gabarit texte + bouton assumé) | ✅ conforme à la décision documentée dans `design.md` |

## 5. Bugs trouvés

Aucun bug fonctionnel trouvé. Aucun `BUG-00x` à ouvrir.

## 6. Recommandations

- ~~QA-004-01 (mineure) : ajouter un test nommé explicitement pour la propagation d'un `GitlabTimeoutException` au niveau `SyncService`.~~ **Traité en Phase 5** (`sync.service.spec.ts::should_not_interrupt_other_projects_when_one_times_out`).
- Pas de dette identifiée sur le reste du périmètre. La limite d'absence de tests e2e sur la persistance réelle des MRs (pas d'API de lecture dans cette US) est déjà documentée comme acceptée dans `dev-report.md` et sera comblée naturellement par US-005.

## 7. Conclusion

**US-004 validée**, sans réserve après la Phase 5 (revue de code).
