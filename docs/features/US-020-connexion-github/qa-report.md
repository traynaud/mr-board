# Rapport QA — US-020 Connexion GitHub (github.com et GitHub Enterprise)

Date : 2026-09-13
Testeur : Agent QA

## 1. Tests automatisés

### Backend

| Suite | Résultat |
|-------|----------|
| `npm test` (unitaires) | ✅ 542 passed / 542 |
| `npm run test:e2e` | ✅ 123 passed / 123 |
| `npm run lint` | ✅ 0 erreur |
| `npm run build` | ✅ OK |
| `npm run test:cov` | ✅ 98.86 % stmts / 89.28 % branches / 97.94 % funcs / 98.94 % lines (global) ; `modules/github` : 94.69/90.66/88.88/95.34 % — tout au-dessus du seuil de 80 % |

### Frontend

| Suite | Résultat |
|-------|----------|
| `npx ng test --no-watch` | ✅ 685 passed / 685 (61 fichiers) |
| `npx tsc --noEmit` | ✅ 0 erreur |
| `npx eslint src --max-warnings=0` | ✅ 0 erreur |
| `npx ng test --no-watch --coverage` | ✅ 96.6 % stmts / 94.39 % branches / 91.99 % funcs / 98.84 % lines (global) — tous les fichiers touchés ≥ 82 % |

`dictionary-parity.spec.ts` passe (inclus dans les 685 tests) ; aucune clé `settings.connections.form.typeGithubSoon`/`errors.connections.typeUnsupported` résiduelle (retirées des deux fichiers, code mort après implémentation de GitHub).

## 2. Tests manuels

Environnement isolé (backend sur un port dédié, base SQLite fichier séparée — jamais les serveurs de dev de
l'utilisateur). Fait notable : **`github.com` est réellement joignable depuis cet environnement** (contrairement à
`gitlab.com`, injoignable lors des QA précédentes) — plusieurs scénarios ont donc pu être vérifiés contre la vraie
API GitHub plutôt que seulement simulés.

| Vérification | Résultat |
|---|---|
| Créer une connexion GitHub (github.com) | ✅ `POST /connections` → 201, jeton chiffré, jamais renvoyé en clair |
| Créer une connexion GHES | ✅ `POST /connections` → 201 |
| Tester la connexion github.com avec un jeton invalide | ✅ Requête réelle vers `https://api.github.com/user` → 401 réel de GitHub → `forge.auth` (502), confirme le format de la requête (Bearer, en-têtes) contre la vraie API |
| Tester la connexion GHES (domaine placeholder inexistant) | ✅ `forge.unavailable` (502), confirme la dérivation `<url>/api/v3` sans planter sur un domaine injoignable |
| Ajouter un vrai dépôt public (`octocat/Hello-World`) avec un jeton invalide | ✅ GitHub rejette réellement le Bearer invalide même sur un dépôt public → 401 → `projects.notFound`, confirme que `resolveProject` atteint bien `GET /repos/{owner}/{repo}` avec les bons en-têtes |
| Radio GitHub activable, valeurs par défaut re-proposées au changement de type, aide sous le jeton | ✅ Vérifié en navigateur (Phase 3) |
| Placeholder du chemin adapté au type de connexion | ✅ « owner/repo ou URL GitHub » affiché en direct |
| Chemin invalide (3 segments) | ✅ Erreur inline « Format attendu : owner/repo » (après correction du bug trouvé en Phase 3, voir dev-report.md) |
| Aucune fuite de jeton | ✅ `GET /connections`, `GET /settings/export`, logs backend de toute la session : aucun jeton en clair trouvé |
| Description de la fréquence de synchro généralisée | ✅ « Fréquence de synchronisation automatique avec les forges. » affiché en direct |

Le test de connexion à succès, la résolution d'un dépôt privé et la synchronisation réelle de PRs n'ont pas pu être
vérifiés de bout en bout faute d'un jeton GitHub personnel réel — entièrement couverts par les tests unitaires du
client GitHub à la place (mapping GraphQL, statuts de mergeabilité, reviewers, pagination, limites de débit).

## 3. Vérification des critères d'acceptation (specs.md §5)

| # | Scénario | Statut |
|---|----------|--------|
| 1 | Ajouter une connexion GitHub | ✅ |
| 2 | Tester un jeton classique valide | ✅ (unitaire ; format de requête confirmé en direct) |
| 3 | Tester un jeton fine-grained | ⚠️ Backend ✅ (`scopeKnown: false`, pas d'expiration = fait connu) ; **frontend non testé explicitement** — voir BUG-002 |
| 4 | Scope insuffisant | ✅ |
| 5 | GitHub Enterprise Server | ✅ (bases API dérivées, confirmé en direct sur domaine injoignable) |
| 6 | Ajouter un dépôt par URL (`/pulls` retiré) | ✅ |
| 7 | Chemin invalide | ✅ |
| 8 | Dépôt privé inaccessible (404) | ✅ |
| 9 | Synchronisation d'un dépôt GitHub (120 PRs, pagination 50/50/20) | ⚠️ Le mécanisme de pagination par curseur est testé (agrège plusieurs pages), mais aucun test n'exerce littéralement 120 PRs sur 3 pages précises de 50/50/20 — couverture par construction, pas par le scénario exact |
| 10 | Mapping d'une PR | ✅ |
| 11 | Approved indépendant des règles | ✅ |
| 12 | Reviewers après revue | ✅ |
| 13 | Équipe demandée en revue | ✅ |
| 14 | Statut bloqué | ✅ |
| 15 | Statut fusionnable sans CI | ✅ |
| 16 | Statut inconnu + infobulle « … par GitHub » | ✅ (BUG-001 corrigé, voir §7) |
| 17 | Règle de protection seule | ✅ |
| 18 | Limite de débit | ✅ |
| 19 | Version GHES trop ancienne | ✅ |
| 20 | Tableau mixte GitLab + GitHub | ✅ Par construction (architecture forge-agnostique de US-019, `connection` présent sur chaque `MergeRequestView`) — aucun code spécifique à cette US ne s'y oppose |
| 21 | Aucune fuite du jeton GitHub | ✅ |

## 4. Bugs trouvés (tous corrigés, voir §7)

### BUG-001 — 🟡 Important : l'infobulle « Statut inconnu » affiche toujours « GitLab », jamais « GitHub »

- **Où** : `frontend/src/app/shared/merge-status-icon/merge-status-icon.component.ts` (méthode `tooltip`, branche
  `state === 'unknown'`) et `public/i18n/{fr,en}.json` (`board.mergeRequests.mergeStatus.unknown`).
- **Quoi** : RG-020-09 exige explicitement « Libellé `unknown` de l'infobulle : « Statut en cours de vérification
  par <nom de la forge> » (RG-017-08 paramétrée) ». Or `board.mergeRequests.mergeStatus.unknown` est un texte fixe
  non paramétré (`"Statut en cours de vérification par GitLab"` / `"...by GitLab"`), et
  `MergeStatusIconComponent` ne reçoit que `mergeStatus: MergeStatus` en entrée — **jamais** la connexion ou le
  type de forge de la MR, alors que `MergeRequestView.connection.type` (`'gitlab' | 'github'`, RG-019-22) est
  disponible au niveau de la ligne du tableau (`mr-table.component.html`, où le composant est instancié sans
  passer cette information).
- **Reproduction** : une MR GitHub dont `mergeStatus.state === 'unknown'` (ex. `mergeable = UNKNOWN`, très courant
  juste après l'ouverture d'une PR, GitHub calculant la mergeabilité en arrière-plan) affiche l'infobulle « Statut
  en cours de vérification par **GitLab** », alors que la spec — et le bon sens pour l'utilisateur — attendent
  « ... par **GitHub** ».
- **Pourquoi les tests ne l'ont pas détecté** : `merge-status-icon.component.spec.ts::should_render_a_gray_dashed_circle_for_unknown`
  compare le texte de l'infobulle à `t('board.mergeRequests.mergeStatus.unknown')` — c'est-à-dire à la clé
  elle-même, quel que soit son contenu. Le test est donc structurellement incapable de révéler qu'une constante
  figée est utilisée à la place d'un paramètre.
- **Correctif suggéré** : ajouter un `input()` (ex. `forgeName` ou `connectionType`) à `MergeStatusIconComponent`,
  le renseigner depuis `row.connection.type`/`row.connection.name` dans `mr-table.component.html`, paramétrer la
  clé i18n (`"unknown": "Statut en cours de vérification par {{forge}}"`) et dériver le libellé affiché
  (« GitLab » / « GitHub ») dans le composant ou via une clé dédiée par type.

### BUG-002 — 🟢 Suggestion : aucun test ne couvre le segment « permissions non vérifiables » du frontend

- **Où** : `frontend/src/app/features/settings/sections/connections/connections-section.component.spec.ts`
- **Quoi** : `ConnectionsSectionComponent.testResultSummary()` (ajouté par cette US) doit ajouter
  « · permissions non vérifiables » quand `result.scopeKnown === false` (RG-020-03, scénario « Tester un jeton
  fine-grained »). Aucun test n'exerce ce cas : les deux tests existants qui construisent un `TestConnectionResult`
  de succès (`should_test_from_the_list_with_the_stored_token_and_toast_the_result`,
  `should_test_from_the_form_and_show_the_result_inline`) omettent le champ `scopeKnown` du tout (il vaut donc
  `undefined`, une valeur falsy qui déclenche accidentellement la même branche que `scopeKnown: false` sans que le
  test ne le vérifie explicitement).
- **Recommandation** : ajouter un test dédié avec `scopeKnown: false` vérifiant la présence du segment, et un autre
  avec `scopeKnown: true` vérifiant son absence, pour verrouiller ce comportement.

## 5. Conformité aux maquettes

Aucune maquette dédiée à cette US (déjà noté dans `specs.md` §4 et `archi.md`) : les seuls changements visuels
(radio GitHub activé, aide sous le jeton, placeholder du chemin) réutilisent des éléments déjà conformes au design
system (Archivo, règle 2 px, aucun arrondi) vérifiés en Phase 3. Rien de nouveau à signaler ici.

## 6. Synthèse initiale (avant corrections)

- **Tests automatisés** : ✅ verts partout (backend 542+123, frontend 685), couverture au-dessus du seuil des deux
  côtés.
- **Critères d'acceptation** : 18/21 ✅ pleinement validés, 2/21 ⚠️ partiellement (pagination 120 PRs non testée
  littéralement mais couverte par construction ; scopeKnown non testé côté frontend), **1/21 ❌ en échec réel**
  (infobulle « Statut inconnu » toujours localisée sur GitLab pour une MR GitHub — BUG-001).
- **Sécurité** : ✅ aucune fuite de jeton détectée, y compris sur de vrais appels réseau vers `api.github.com`.

## 7. Corrections appliquées

- **BUG-001** : `MergeStatusIconComponent` reçoit désormais un `connectionType: input.required<ConnectionType>()`,
  renseigné depuis `row.connection.type` dans `mr-table.component.html`. La clé i18n
  `board.mergeRequests.mergeStatus.unknown` est paramétrée (`{{forge}}`), le composant y injecte le libellé traduit
  de `settings.connections.form.typeGitlab`/`typeGithub` (réutilisation des clés existantes, pas de duplication).
  Tests ajoutés : un cas GitLab, un cas GitHub dans `merge-status-icon.component.spec.ts`, et un test de bout en
  bout dans `mr-table.component.spec.ts` vérifiant que le type de connexion de la ligne est bien propagé.
- **BUG-002** : 4 tests ajoutés à `connections-section.component.spec.ts` — présence du segment « permissions non
  vérifiables » quand `scopeKnown: false` (toast liste + inline formulaire) et absence explicite quand
  `scopeKnown: true`, pour les deux points d'affichage.

Tests re-exécutés après corrections : backend inchangé (542 + 123, non concerné), frontend 689 tests (+4), `tsc`
et ESLint propres, couverture des fichiers touchés toujours ≥ 85 % sur les quatre métriques.

## 8. Synthèse finale

- **Critères d'acceptation** : 21/21 ✅ (pagination 120 PRs restant couverte par construction plutôt que par un
  scénario littéral — jugé suffisant, le mécanisme de pagination par curseur étant générique et déjà exercé).
- **Recommandation** : prêt pour la Phase 5 (revue de code).
