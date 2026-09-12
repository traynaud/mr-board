# Rapport QA — US-006 Difficulté de la MR

## 1. Tests automatisés

| Suite | Résultat |
|---|---|
| Backend lint (`npm run lint`) | ✅ 0 erreur |
| Backend unitaires (`npm test`) | ✅ 213 passés / 213 |
| Backend e2e (`npm run test:e2e`) | ✅ 53 passés / 53 |
| Backend couverture (`npm run test:cov`) | ✅ 99,08 % statements / 85,9 % branches (seuil 80 %) |
| Frontend `tsc --noEmit` | ✅ 0 erreur |
| Frontend lint (`ng lint`) | ✅ 0 erreur |
| Frontend unitaires + couverture (`ng test --no-watch --coverage`) | ✅ 222 passés / 222 — 99,17 % statements / 93,96 % branches (seuil 80 %) |
| Frontend build (`ng build`) | ✅ succès |

Aucun fichier créé ou modifié par cette US n'est sous le seuil de 80 %.

## 2. Couverture des critères d'acceptation (specs.md §6)

| # | Scénario | Statut | Test(s) |
|---|---|---|---|
| 1 | Calcul de la difficulté (9 exemples RG-G03) | ✅ | `calculate-difficulty.spec.ts` (9 exemples + 4 bornes exactes) |
| 2 | Rendu de la cellule (hard, 34 f · 1240 l) | ✅ | `mr-table.component.spec.ts::should_render_the_difficulty_badge_for_each_row`, `difficulty-badge.component.spec.ts::should_render_a_colored_square_label_and_meta_for_hard` |
| 3 | Tooltip détaillé avec séparateur de milliers | ✅ | `difficulty-badge.component.spec.ts::should_show_a_detailed_tooltip_with_thousands_separator`, `format-number.spec.ts` |
| 4 | Statistiques indisponibles (« ? » + tooltip) | ✅ | `difficulty-badge.component.spec.ts::should_show_a_question_mark_and_unavailable_tooltip_when_stats_are_null` |
| 5 | Champs API (difficulty, changedFiles, additions, deletions, changedLines) | ✅ | `merge-requests.e2e-spec.ts::should_expose_only_the_fields_in_scope_of_this_us` (vérifie l'ensemble exact des clés) |

**Deux scénarios ajoutés en Phase 1/2, non présents dans le brouillon initial, également couverts** :

| Scénario | Statut | Test(s) |
|---|---|---|
| Distinction vrai zéro vs statistiques indisponibles | ✅ | `merge-requests.service.spec.ts::should_distinguish_a_real_zero_from_unavailable_stats`, `merge-requests.e2e-spec.ts::should_distinguish_a_real_zero_from_unavailable_stats` |
| Repli sur `medium` + champs `null` si stats indisponibles | ✅ | `merge-requests.service.spec.ts::should_report_medium_difficulty_and_null_stats_when_diff_stats_are_unavailable`, `merge-requests.e2e-spec.ts::should_report_medium_difficulty_and_null_stats_when_unavailable` |

**7/7 scénarios validés** (5 des specs originales + 2 ajoutés par la correction de RG-006-02 en Phase 1).

## 3. Tests API manuels

Backend lancé en local (`APP_SECRET`, `DB_PATH=:memory:`) :

| Vérification | Résultat |
|---|---|
| Démarrage de l'application avec la nouvelle migration (`AllowNullDiffStats`) sur une base fraîche | ✅ aucune erreur au démarrage |
| `GET /api/v1/health` après migration → base toujours accessible | ✅ |
| `GET /api/v1/merge-requests` à froid → `200 []` | ✅ |

**Limite de ce passage manuel** : comme pour les US précédentes, sans jeton GitLab valide il n'a pas été possible de
synchroniser de vraies MRs pour observer manuellement le contenu réel de la colonne Difficulté. Cette couverture
repose sur les tests automatisés (e2e avec `GitlabClientService` mocké, unitaires avec repositories mockés), jugée
suffisante. Le point le plus à risque de cette US — la migration SQLite recréant la table `merge_requests` sans
perte de donnée — a en revanche été vérifié à la fois par la suite e2e complète (qui insère et relit de vraies
lignes après migration) et par ce test manuel de démarrage.

## 4. Conformité aux maquettes (`docs/design/`, `design.md`)

Vérification par lecture de code :

| Point | Statut |
|---|---|
| Markup de la cellule conforme au prototype (carré 12 px + libellé + méta, `display:inline-flex; gap:8px`) | ✅ |
| Couleurs : Easy `--color-success`, Medium `--color-warning`, Hard `--color-accent` — aucune nouvelle couleur introduite | ✅ |
| Aucune icône nécessaire, aucune couleur ni `border-radius` en dur (hors `border-radius: 0` explicite) | ✅ (vérifié par recherche statique) |
| Position de la colonne (entre Titre et 💬) conforme à RG-005-02/RG-006-03 | ✅ |
| État indisponible : gabarit visuel cohérent avec les tirets « — » déjà utilisés en US-005 (`--color-neutral-600`) | ✅ |

## 5. Bugs trouvés

Aucun bug fonctionnel trouvé. Aucun `BUG-00x` à ouvrir.

## 6. Recommandations

Aucune recommandation bloquante. Le point de style relevé par le développeur (`DifficultyBadgeComponent` injectant
`TranslateService` directement plutôt que d'utiliser `TranslatePipe`) est un choix justifié par le besoin
d'interpolation dans des `computed()` — pas une dette à traiter.

## 7. Conclusion

**US-006 validée.** Prête pour la Phase 5 (revue de code).
