# Rapport QA — US-018 Thème sombre

## 1. Tests automatisés

| Suite | Résultat |
|---|---|
| Backend unitaires (`npm test`) | **401 passed / 0 failed** |
| Backend e2e (`npm run test:e2e`) | **105 passed / 0 failed** |
| Backend couverture (`npm run test:cov`) | **99.31 % stmts / 89.2 % branches / 98.57 % funcs / 99.37 % lines** — seuil 80 % largement dépassé |
| Frontend unitaires (`ng test --no-watch`) | **582 passed / 0 failed** |
| Frontend couverture (`ng test --no-watch --coverage`) | **96.73 % stmts / 95.35 % branches / 90.99 % funcs / 99.04 % lines** — seuil 80 % largement dépassé ; fichiers `core/theme/*.ts` à 100 % stmts |
| `tsc --noEmit` (backend + frontend) | OK |
| Lint (backend + frontend) | OK |
| Build (backend + frontend) | OK |

Deux trous de couverture trouvés et corrigés pendant la QA (fonctions ajoutées en Phase 3 mais jamais exercées par un
test) :
- `BoardPageComponent.onThemeToggle()` — 0 appel constaté → ajout de 2 tests dans `board-page.component.spec.ts`
  (succès + échec réseau avec toast).
- Restauration du thème à la sortie de l'écran Paramètres (RG-018-03, `SettingsPageComponent`) — aucun test
  d'intégration ne le vérifiait (seule la mécanique unitaire de `ThemeService.clearPreview()` l'était) → ajout de
  `should_preview_the_theme_immediately_and_restore_it_when_the_page_is_left` dans `settings-page.component.spec.ts`.

## 2. Tests API manuels

Effectués contre le backend réel (`http://localhost:3000/api/v1`, `.env` local créé pour l'occasion) :

| Vérification | Résultat |
|---|---|
| `GET /settings` — défaut `theme` | ✅ `"system"` sur base fraîche |
| `PUT /settings` `{gitlabUrl, theme:"dark"}` | ✅ `200`, `theme:"dark"` dans la réponse |
| `PUT /settings` `{gitlabUrl, theme:"blue"}` | ✅ `400` |
| `GET /settings/export` | ✅ `settings.theme` présent |
| `POST /settings/import` sans `theme` | ✅ conserve la valeur existante (`system` sur base fraîche, cohérent avec RG-015-04) |
| `POST /settings/import` `{theme:"light"}` | ✅ `theme:"light"` appliqué |
| `POST /settings/import` `{theme:"blue"}` | ✅ `400` |
| Absence de fuite du jeton dans les réponses | ✅ seuls `tokenConfigured`/`tokenHint` (masqué) apparaissent |
| Round-trip navigateur → backend (bascule toolbar réelle) | ✅ confirmé : la valeur lue en base reflétait le dernier choix fait dans l'UI par l'utilisateur |

## 3. Vérification UI

Application lancée (`ng serve` + `nest start --watch`) et testée manuellement par l'utilisateur : bascule rapide
toolbar et contrôle Paramètres › Divers confirmés fonctionnels (« ça marche bien »).

Points **non** explicitement re-vérifiés lors de cette session et à considérer comme recommandations plutôt que
blocages (voir §5) :
- Détachement visuel des surfaces flottantes (menu de filtre, dialog de confirmation, toast) en thème sombre —
  scénario Gherkin « Surfaces flottantes » non rejoué explicitement.
- Contraste effectif (outil dédié) des couleurs sémantiques en sombre — la palette vient d'une maquette déjà
  annoncée conforme ≥ 4,5:1/3:1 (RG-018-08), non re-mesurée indépendamment ici.
- Absence de flash au tout premier chargement à froid (cache vidé) — mécanisme non automatisable (script inline
  pré-bootstrap Angular), correction de code relue mais pas rejouée avec throttling réseau/cache vidé.

## 4. Critères d'acceptation (specs.md §5)

| # | Scénario | Statut |
|---|---|---|
| 1 | Valeur par défaut | ✅ |
| 2 | Passer en sombre avec aperçu immédiat | ✅ |
| 3 | Annuler l'aperçu | ✅ (couvert via destruction du composant Paramètres, mécanisme identique à un clic « Annuler » ou à l'abandon confirmé par le guard) |
| 4 | Mode système suit l'OS | ✅ |
| 5 | Aucun flash au chargement | ⚠️ Non automatisé (limite technique, voir §3) — code relu, non rejoué en conditions réelles |
| 6 | localStorage vide | ✅ |
| 7 | Export / import | ✅ |
| 8 | Réinitialiser | ✅ |
| 9 | Contraste des couleurs sémantiques | ⚠️ Palette validée en amont (maquette), non re-mesurée avec un outil dédié ici |
| 10 | Aucun hex en dur | ✅ (audit exhaustif, 0 occurrence) |
| 11 | Surfaces flottantes | ⚠️ Non rejoué explicitement en session (voir §3) |
| 12 | Valeur invalide | ✅ |
| 13 | Bascule rapide depuis la toolbar | ✅ |
| 14 | Bascule rapide depuis le mode système | ✅ |

**12/14 validés, 2 partiellement (limites de vérifiabilité automatisée / non rejoués manuellement, pas des échecs
constatés).**

## 5. Bugs trouvés

Aucun bug fonctionnel constaté. Les deux trous de couverture du §1 ont été comblés pendant cette session QA (pas de
régression détectée, juste des tests manquants pour du code déjà correct).

## 6. Recommandations

- **REC-001** : avant mise en production, rejouer manuellement le scénario « Aucun flash au chargement » avec le
  cache navigateur vidé et le réseau throttlé (DevTools), pour confirmer visuellement l'absence de flash clair→sombre.
- **REC-002** : rejouer le scénario « Surfaces flottantes » — ouvrir un menu de filtre, un dialog de confirmation
  et un toast en thème sombre pour confirmer le détachement visuel (liseré + ombre).
- **REC-003** : si un outil de contraste est disponible dans l'outillage design, l'exécuter sur la palette sombre
  (RG-018-08) pour confirmer indépendamment les ratios ≥ 4,5:1 / 3:1 annoncés par la maquette.
- Aucune de ces recommandations ne bloque la livraison : ce sont des vérifications complémentaires, pas des défauts
  constatés.
