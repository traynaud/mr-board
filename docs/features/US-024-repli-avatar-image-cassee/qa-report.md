# Rapport QA — US-024 Repli sur les initiales quand l'image d'avatar ne charge pas

Testé le 2026-09-14.

## 1. Tests automatisés

| Suite | Résultat |
|-------|----------|
| Frontend (`ng test --no-watch --coverage`) | ✅ 716 passed / 0 failed (62 suites, +3 tests) |
| `tsc --noEmit` / `ng build` / `ng lint` | ✅ |
| Couverture `shared/avatar/avatar.component.ts` | **100 %** sur les 4 métriques (statements/branch/functions/lines) — absent du tableau de couverture, qui n'imprime que les fichiers avec au moins une métrique < 100 % |

Backend non concerné (US frontend uniquement) — aucune suite backend n'a besoin d'être relancée, rien n'y a changé.

## 2. Vérification UI contre les maquettes

⚠️ **Non réalisée en direct**, comme lors de la QA de US-021 : l'extension Claude in Chrome reste déconnectée dans
cet environnement (`tabs_context_mcp` échoue avec « Browser extension is not connected »). Compensé par le fait
que le mécanisme est entièrement couvert par les tests unitaires (voir §1), qu'il ne touche à aucun style ni
aucune maquette (le rendu « initiales » réutilisé est déjà celui de RG-G12/US-005, inchangé), et par une relecture
du code final.

**Recommandation** : forcer une URL d'avatar invalide dans `ng serve` (ou couper le réseau vers la forge) pour
confirmer visuellement dès que l'extension est disponible.

## 3. Critères d'acceptation

| Scénario (specs.md) | Statut |
|----------------------|--------|
| Image d'avatar valide | ✅ `should_render_image_with_alt_when_avatar_url_is_set` (préexistant, toujours vert) |
| Avatar absent dès le départ | ✅ `should_render_initials_and_tooltip_when_no_avatar_url` (préexistant, toujours vert) |
| Lien d'avatar cassé | ✅ `should_fallback_to_initials_when_the_image_fails_to_load_rg_024_01` |
| Pas de nouvelle tentative en boucle | ✅ `should_not_retry_the_same_url_after_it_already_failed_rg_024_02` |
| Nouvelle URL après un précédent échec | ✅ `should_retry_loading_a_new_url_after_a_previous_failure_rg_024_02` |
| Repli appliqué dans tous les contextes d'utilisation | ✅ par construction, vérifié par lecture de code plutôt que par un test dédié — `grep` confirme qu'`AvatarComponent` est le seul point de rendu d'avatar de l'application (`mr-table.component.html` et `me-section.component.html` le consomment sans logique de rendu propre) ; aucune duplication de balise `<img>` ailleurs dans le code |

**6/6 scénarios validés.**

## 4. Bugs trouvés

Aucun. Le correctif est isolé, entièrement testé, et n'introduit aucune régression détectable sur les tests
existants de `AvatarComponent` (image valide, absence d'URL, variantes `filled`/`outlined`, anneau `highlighted`,
tooltip) ni sur le reste de la suite frontend.

## 5. Recommandations

1. Vérification visuelle en direct dès que l'extension Claude in Chrome sera disponible (§2) — non bloquant vu la
   couverture de test et la simplicité du changement.
2. Rien d'autre à signaler : US prête pour la revue de code.
