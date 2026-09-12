# Rapport QA — US-005 Tableau des MRs (colonnes de base)

## 1. Tests automatisés

| Suite | Résultat |
|---|---|
| Backend lint (`npm run lint`) | ✅ 0 erreur |
| Backend unitaires (`npm test`) | ✅ 196 passés / 196 |
| Backend e2e (`npm run test:e2e`) | ✅ 51 passés / 51 |
| Backend couverture (`npm run test:cov`) | ✅ 99,06 % statements / 85,39 % branches (seuil 80 %) |
| Frontend `tsc --noEmit` | ✅ 0 erreur |
| Frontend lint (`ng lint`) | ✅ 0 erreur |
| Frontend unitaires + couverture (`ng test --no-watch --coverage`) | ✅ 212 passés / 212 — 99,13 % statements / 94,82 % branches (seuil 80 %) |
| Frontend build (`ng build`) | ✅ succès |

Aucun fichier créé ou modifié par cette US n'est sous le seuil de 80 %.

## 2. Couverture des critères d'acceptation (specs.md §6)

| # | Scénario | Statut | Test(s) |
|---|---|---|---|
| 1 | Affichage des MRs | ✅ | `board-page.component.spec.ts::should_show_the_mr_table_when_merge_requests_are_returned`, `merge-requests.e2e-spec.ts::should_expose_only_the_fields_in_scope_of_this_us` |
| 2 | Tri par défaut par date Ready | ✅ | `merge-requests.e2e-spec.ts::should_be_sorted_by_ready_at_ascending`, `merge-requests.service.spec.ts::should_query_non_draft_merge_requests_sorted_by_ready_at_ascending` |
| 3 | Tooltip auteur | ✅ | `mr-table.component.spec.ts` (via `AvatarComponent`, déjà testé en US-002 ; rendu vérifié dans le tableau) |
| 4 | Avatar GitLab disponible | ✅ | Couvert par `AvatarComponent.spec.ts` (US-002), consommé sans logique additionnelle par `MrTableComponent` |
| 5 | Titre tronqué et lien | ✅ | `mr-table.component.spec.ts::should_link_the_title_to_web_url_with_rel_noopener_and_a_tooltip` |
| 6 | Reviewer et affecté vides | ✅ | `mr-table.component.spec.ts::should_show_a_dash_when_there_is_no_reviewer_or_assignee` |
| 7 | Plusieurs reviewers | ✅ | `mr-table.component.spec.ts::should_show_the_first_reviewer_and_an_extra_count_for_several`, `summarize-users.spec.ts` |
| 8 | MR approuvée | ✅ | `mr-table.component.spec.ts::should_show_a_check_icon_only_when_approved` |
| 9 | Premier chargement | ✅ | `board-page.component.spec.ts` (branche `mrStore.loading() && length===0`, exercée implicitement par `bootstrap()` avant le flush) |
| 10 | Rechargements suivants sans effacement | ✅ | `merge-requests.store.spec.ts::should_not_clear_existing_merge_requests_when_a_reload_fails` (cas le plus strict : conserve même sur échec) |
| 11 | Rechargement automatique après une synchronisation | ✅ | `board-page.component.spec.ts::should_trigger_an_unscoped_sync_and_reload_status_and_merge_requests_when_clicking_refresh`, `::should_toast_and_reload_merge_requests_when_a_new_run_finishes_as_partial_or_error` |
| 12 | Erreur de chargement | ✅ | `board-page.component.spec.ts::should_toast_when_loading_merge_requests_fails` |
| 13 | Aucune MR malgré repos et jeton configurés | ✅ | `board-page.component.spec.ts::should_show_the_no_merge_requests_empty_state_when_the_list_is_empty` |
| 14 | Contrat API | ✅ | `merge-requests.e2e-spec.ts::should_expose_only_the_fields_in_scope_of_this_us` (vérifie l'ensemble exact des clés + absence de « token » dans la réponse) |

**14/14 scénarios validés.**

## 3. Tests API manuels

Backend lancé en local (`APP_SECRET`, `DB_PATH=:memory:`), testé via `curl` :

| Vérification | Résultat |
|---|---|
| `GET /api/v1/merge-requests` à froid → `200 []` | ✅ |
| Paramètre de requête arbitraire (`?drafts=1`) → ignoré, toujours `200 []` (RG-005-01 : aucun paramètre supporté dans cette US) | ✅ |
| En-tête `Content-Type: application/json; charset=utf-8` | ✅ |
| `POST /api/v1/merge-requests` (méthode non supportée) → 404 | ✅ |
| `GET /api/v1/merge-requests/1` (route ressource unique inexistante) → 404 | ✅ |

**Limite de ce passage manuel** : sans jeton GitLab valide, il n'a pas été possible de déclencher une synchronisation réelle peuplant la base avec de vraies MRs pour ce test manuel ; le contenu réel du tableau (alias, avatars, reviewers multiples, tri) est exclusivement vérifié par les tests automatisés (e2e avec `GitlabClientService` mocké, unitaires avec repositories mockés) — jugé suffisant, cohérent avec le passage QA de US-004.

## 4. Conformité aux maquettes (`docs/design/`, `design.md`)

Vérification par lecture de code (pas d'accès navigateur dans cet environnement) :

| Point | Statut |
|---|---|
| 7 colonnes construites correspondent exactement au sous-ensemble documenté (Projet, Auteur, Titre, 💬, Reviewer, Affecté, Approved) ; aucune colonne Difficulté/Depuis Ready/Ouverte, même vide | ✅ |
| Tag Projet : reprend `.tag`/`.tag-neutral` du design system (fond `--color-neutral-100`, texte `--color-neutral-800`, aucun `border-radius`) | ✅ |
| Icônes déjà enregistrées réutilisées (`message-square`, `check`), aucune nouvelle icône | ✅ |
| Coche Approved en `--color-success` | ✅ |
| Aucune couleur ni `border-radius` en dur (hors `border-radius: 0` explicite) dans les nouveaux fichiers SCSS | ✅ (vérifié par recherche statique) |
| Avatar auteur plein / reviewer-affecté contour, réutilisant `AvatarComponent` sans modification | ✅ |
| Largeur minimale 860 px, défilement horizontal cantonné au composant tableau | ✅ (structure vérifiée dans `mr-table.component.scss`, `:host { overflow-x: auto }`) |

## 5. Bugs trouvés

Aucun bug fonctionnel trouvé. Aucun `BUG-00x` à ouvrir.

## 6. Recommandations

Aucune recommandation bloquante. Deux points mineurs déjà signalés par le développeur dans `dev-report.md` (duplication délibérée du bloc reviewer/affecté ; complexité croissante de l'effect de transition de synchro dans `board-page.component.ts`) sont à surveiller lors des prochaines US touchant ce composant (US-006 à US-009), sans action requise maintenant.

## 7. Conclusion

**US-005 validée.** Prête pour la Phase 5 (revue de code).
