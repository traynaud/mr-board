# Architecture — US-020 Connexion GitHub (github.com et GitHub Enterprise)

## Résumé fonctionnel
Ajoute `github` comme second type de connexion utilisable (RG-019-01 le déclarait déjà, sans implémentation) : test
du jeton, résolution de dépôts `owner/repo`, synchronisation des Pull Requests via GraphQL et mapping vers le
modèle commun `ForgeMergeRequest`/`MergeStatusResult` déjà utilisé par GitLab — sans aucun changement pour le reste
de l'application (tableau, filtres, tri, export/import).

---

## Backend

### Impacts sur le modèle de données
**Aucune migration nécessaire.** Toutes les colonnes concernées sont déjà génériques depuis US-019 :
- `connections.type` est une colonne `text` libre (pas de `CHECK` SQL) — `'github'` y est déjà acceptable.
- `projects.remote_project_id`, `users.remote_user_id`, `merge_requests.remote_id` sont déjà `text` (US-019,
  RG-019-05), prêts pour les `node_id` GitHub.
- `merge_requests.merge_status_state`/`merge_status_reasons` sont déjà génériques (US-017/US-019) : le mapper
  GitHub écrit dedans exactement comme le mapper GitLab.

### Intégration dans les modules existants
- **`modules/forges/`** : `ForgeClientFactory.forType('github')` lève actuellement
  `ForgeTypeUnsupportedException` — remplacé par l'injection de `GithubClientService`. Le contrat `ForgeClient`
  (`forge-client.interface.ts`) gagne une méthode (voir « Modifications sur l'existant »).
- **Nouveau module `modules/github/`**, calqué sur `modules/gitlab/` : `GithubClientService implements ForgeClient`,
  `domain/` (fonctions pures), `mappers/` (mapping GraphQL → types communs), `types/` (formes des réponses REST/
  GraphQL GitHub, jamais exposées hors du module).
- **`modules/connections/`, `modules/projects/`, `modules/sync/`, `modules/merge-requests/`** : **aucun changement**
  — ils ne dépendent que du contrat `ForgeClient` (RG-019-21) et de `ForgeClientFactory`, exactement le découplage
  que US-019 a mis en place pour ce cas précis.
- **`common/exceptions/`** : une nouvelle exception (voir Contrat API).

### Contrat API
Aucune route nouvelle ni changement de forme de réponse — `type: "github"` est simplement une valeur désormais
acceptée par les routes existantes de US-019 (RG-019-22) :

| Méthode | Route | Différence pour `type = github` |
|---------|-------|----------------------------------|
| POST | `/connections` | N'échoue plus avec `connections.typeUnsupported` |
| POST | `/connections/test` | Interroge l'API GitHub (`GET /user`) au lieu de GitLab |
| POST | `/projects` | `path` validé au format `owner/repo` (nouveau code `projects.invalidPath`, 400) |
| GET | `/merge-requests` | `connection.type = "github"` pour les MRs de ces repos ; aucun nouveau champ |

**Nouvelle exception** : `ForgeRateLimitedException` (502, code `forge.rateLimited`) — levée uniquement par
`GithubClientService.testConnection` sur 403 avec `X-RateLimit-Remaining: 0` (RG-020-03). N'existe que côté GitHub :
la synchronisation réutilise `ForgeUnavailableException` après le retry unique (RG-020-11/12), exactement comme le
double-429 de GitLab aujourd'hui — aucune nouvelle exception nécessaire à cet endroit.

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|--------------|
| Étendre `ForgeClient` (`forge-client.interface.ts`) | Interface | Ajoute `normalizePath(input): string \| null` (voir « Modifications sur l'existant ») |
| Étendre `ForgeTestResult` | Type commun | Ajoute `scopeKnown: boolean` (voir « Modifications sur l'existant ») |
| `common/exceptions/business.exception.ts` | Exception | `ForgeRateLimitedException` (`forge.rateLimited`, 502) |
| `modules/forges/domain/normalize-forge-url.ts` | Fonction pure (déplacée) | Généralise `normalizeGitlabUrl` (déjà 100 % générique) — voir « Modifications sur l'existant » |
| `modules/github/github.module.ts` | Module | `providers: [GithubClientService]`, `exports: [GithubClientService]` — même forme que `gitlab.module.ts` |
| `modules/github/github-client.service.ts` | Service | Implémente `ForgeClient` : `normalizeUrl` (délègue à `normalize-forge-url`), `normalizePath`, `testConnection`, `resolveProject`, `fetchOpenMergeRequests` |
| `modules/github/domain/derive-github-api-bases.ts` | Fonction pure | `deriveGithubApiBases(origin): { rest, graphql }` (RG-020-01 : github.com vs GHES) |
| `modules/github/domain/normalize-github-project-path.ts` | Fonction pure | Extrait `owner/repo` d'une URL ou d'un chemin brut, retire `/pulls` et `.git` (RG-020-05) ; ne valide **pas** le nombre de segments (fait par le service, qui lève l'exception) |
| `modules/github/mappers/map-graphql-pull-request.ts` | Mapper | PR GraphQL → `ForgeMergeRequest` (RG-020-07), délègue reviewers et mergeStatus aux deux fonctions suivantes |
| `modules/github/mappers/resolve-github-reviewers.ts` | Fonction pure | Fusionne `reviewRequests` (utilisateurs uniquement, équipes ignorées) et auteurs de `latestOpinionatedReviews`, dédupliqués, auteur exclu (RG-020-08) |
| `modules/github/mappers/compute-github-merge-status.ts` | Fonction pure | Implémentation GitHub de `MergeStatusResult` (RG-020-09), même forme que `compute-gitlab-merge-status.ts` |
| `modules/github/types/*.ts` | Types | Formes des réponses REST (`GET /user`, `GET /repos/:owner/:repo`) et des nœuds GraphQL (PR, utilisateur/bot, revue) |
| Specs unitaires de chaque fichier ci-dessus | Tests | Couverture ≥ 80 %, cas nominaux + limites (bot auteur, équipe en reviewer, tous les codes de `compute-github-merge-status`, pagination, retry rate-limit, erreur de schéma GraphQL) |
| `test/github-projects.e2e-spec.ts` (nouveau) ou extension de `projects.e2e-spec.ts` | Test e2e | `POST /connections` type `github`, `POST /projects` avec chemin invalide (400 `projects.invalidPath`) et valide (mock `GithubClientService`) |
| Extension de `connections.e2e-spec.ts` (si existant) ou `settings.e2e-spec.ts` | Test e2e | `POST /connections/test` type `github` : succès, scope insuffisant, rate limit |

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|---------------------------|--------|--------------------|
| `modules/forges/forge-client.factory.ts` | Injecte `GithubClientService`, retourne son instance pour `'github'` au lieu de lever `ForgeTypeUnsupportedException` | Faible | Un seul `case` à changer ; le test `should_throw_for_unsupported_type` de `forge-client.factory.spec.ts` disparaît (il n'y a plus de type déclaré non supporté) |
| `modules/forges/forge-client.interface.ts` | Ajoute `normalizePath(input: string): string \| null`, avec `@throws BusinessValidationException('projects.invalidPath')` documenté pour les forges qui contraignent la forme du chemin | Faible | `GitlabClientService.normalizePath` délègue à la fonction pure existante `normalizeProjectPath` (aucun changement de comportement pour GitLab, qui ne valide pas de nombre de segments) |
| `modules/projects/projects.service.ts` (`add()`) | Le chemin n'est plus normalisé de façon générique **avant** de connaître la connexion : `resolveConnectionId()`/`connections.findOrThrow()` passent en premier, puis `forge.normalizePath(dto.path)` remplace l'appel à `normalizeProjectPath` | Moyen — réordonnancement d'une méthode déjà bien testée | Le comportement pour GitLab reste identique (délégation vers la même fonction pure) ; ajouter les tests du nouveau chemin d'erreur `projects.invalidPath` pour GitHub |
| `modules/gitlab/gitlab-client.service.ts` | `normalizeUrl` délègue à la fonction déplacée `modules/forges/domain/normalize-forge-url.ts` (renommée, ex `normalizeGitlabUrl`) ; ajoute `normalizePath` (délègue à `normalizeProjectPath`, sans validation de segments) ; `testConnection` renseigne `scopeKnown: info !== null` | Faible | La fonction déplacée est déjà 100 % générique (aucune logique GitLab dedans) — pur renommage/déplacement, tests déplacés avec elle |
| `modules/forges/types/forge-client.interface.ts`/`types/forge-test-result.ts` | Ajoute `scopeKnown: boolean` à `ForgeTestResult` | Faible | Un seul champ ajouté ; `ConnectionsService.test()` ne le manipule pas (passthrough), aucun changement côté service |
| `common/exceptions/business.exception.ts` | Ajoute `ForgeRateLimitedException` | Aucun | Nouvelle classe, n'affecte rien d'existant |
| `app.module.ts` | Importe `GithubModule` | Aucun | Une ligne |

---

## Frontend

### Intégration dans les features existantes
Tout se passe dans `features/settings/sections/connections/` et `features/settings/sections/repositories/`, déjà
livrées par US-019 — aucune nouvelle route, aucun nouveau composant.

### Composants réutilisables et Angular Material
Aucun nouveau composant Material : le formulaire de connexion, ses champs et son `mat-radio-group` existent déjà
(US-019) ; seule l'option « GitHub » passe de désactivée à activée.

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|--------------|
| `models/connection.model.ts` | Modèle | `TestConnectionResult` gagne `scopeKnown: boolean` (miroir du backend) |
| `features/settings/connections-form.ts` | Formulaire | `DEFAULT_URLS: Record<ConnectionType, string>` (`gitlab.com` / `github.com`) ; `resetConnectionFormForAdd` et l'effet qui pré-remplit l'URL par défaut à la sélection du type utilisent cette table au lieu de la constante unique `DEFAULT_GITLAB_URL` |
| `features/settings/sections/connections/connections-section.component.html` | Template | Retire `disabled`/le tooltip « Bientôt disponible » du `mat-radio-button` GitHub (RG-020-01) ; ajoute l'aide sous le champ Jeton, visible uniquement quand `type = github` (RG-020-14) ; le toast de succès de test ajoute le segment « permissions non vérifiables » quand `!result.scopeKnown` |
| `features/settings/sections/repositories/repositories-section.component.ts`/`.html` | Composant | Le placeholder du champ chemin dépend du type de la connexion sélectionnée (RG-020-05) : nouveau `pathPlaceholderKey` calculé depuis `connectionsStore.connections()` + `addForm.controls.connectionId` (ou la connexion unique) |
| `public/i18n/fr.json` **et** `en.json` | i18n | Voir détail ci-dessous — toujours dans les deux fichiers (RG-019-26/dictionary-parity) |
| Specs des fichiers ci-dessus | Tests | Radio GitHub activable, sélection du type met à jour l'URL par défaut, aide conditionnelle, placeholder conditionnel, segment « permissions non vérifiables » du toast |

Détail des clés i18n nouvelles/modifiées :
- `settings.connections.form.typeGithub` existe déjà ; **retirer** `typeGithubSoon` (devenu mort) et le binding
  `disabled`/tooltip associé dans le template.
- Nouvelle clé `settings.connections.form.tokenHelpGithub` (le texte RG-020-14, affiché sous le champ Jeton
  seulement pour `type = github`).
- Nouvelle clé `settings.connections.result.scopeUnknown` (« permissions non vérifiables »), concaténée au message
  de succès du test comme le sont déjà `expires`/`noExpiry`/`unknownExpiry`.
- `settings.projects.pathPlaceholder` devient `pathPlaceholderGitlab`/`pathPlaceholderGithub` (ou un seul texte
  paramétré par le nom de la forge — à trancher en Phase 3 selon ce qui reste le plus simple à tester).
- Nouvelle clé `errors.projects.invalidPath` (« Format attendu : owner/repo »).
- Nouvelle clé `errors.forge.rateLimited` (« Échec : limite de débit GitHub atteinte, réessayez plus tard »).
- `settings.refresh.description` (RG-020-15) : « Fréquence de synchronisation automatique avec GitLab. » → «
  … avec les forges. ».
- Voir « ⚠️ Points à clarifier » pour `errors.forge.scope`, dont le texte actuel est spécifique à GitLab.

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|---------------------------|--------|--------------------|
| `connections-form.ts` (`DEFAULT_GITLAB_URL`) | Remplacée par une table par type | Faible | Les appelants (`resetConnectionFormForAdd`) prennent le type en paramètre ; `deriveDefaultConnectionName` est déjà générique, aucun changement |
| `connections-section.component.ts` | Un effet existant re-synchronise déjà l'URL/le nom par défaut quand le type change en mode ajout (à vérifier en Phase 3 — sinon, à ajouter, US-019 n'ayant eu qu'un seul type à proposer) | Faible | Couvert par un nouveau test : changer le type dans le formulaire d'ajout doit mettre à jour l'URL et le nom proposés |
| `repositories-section.component.ts` | Le placeholder n'est plus une constante i18n statique mais un computed | Faible | Le cas à une seule connexion (le plus fréquent) reste trivial : type de l'unique connexion |

---

## ⚠️ Points à clarifier

1. **Texte de `errors.forge.scope` incompatible entre forges.** RG-020-03 exige, pour GitHub, le message « Échec :
   scope insuffisant (repo ou public_repo requis) », alors que ce même code d'erreur (`forge.scope`, levé aussi par
   GitLab) affiche aujourd'hui « Échec : scope insuffisant (read_api requis) ». Le frontend traduit uniquement par
   `code` (jamais par un paramètre transmis par le backend) : un seul texte fixe est possible par code.
   **Proposition retenue par défaut** (à valider) : neutraliser le message en « Échec : scope insuffisant », sans
   citer de scope précis — le scope exact requis par forge reste visible en permanence dans l'aide sous le champ
   Jeton (RG-001-02 pour GitLab, RG-020-14 pour GitHub), donc l'utilisateur n'est jamais privé de cette information,
   seulement pas au même endroit. Alternative : garder deux codes distincts (`forge.scope`/`forge.scopeGithub`),
   rejetée pour ne pas dupliquer une même notion métier sous deux codes selon la forge alors que rien d'autre ne
   les distingue (même classe d'exception, même statut HTTP).
2. **`resolveGithubReviewers` et l'ordre chronologique des revues.** RG-020-08 demande les reviewers déjà passés
   par revue dans « l'ordre chronologique » de leur revue ; le champ `latestOpinionatedReviews` ne garantit un ordre
   que si la requête GraphQL trie explicitement (`orderBy` n'existe pas sur ce connecteur, l'ordre par défaut de
   GitHub pour les revues est chronologique de soumission) — à vérifier contre l'API réelle en Phase 3 (aucun accès
   réseau sortant dans cet environnement de développement) ; défaut proposé : conserver l'ordre renvoyé tel quel,
   documenté comme une hypothèse.
3. **Détection GHES vs github.com** : comparaison stricte de l'origine normalisée à `https://github.com`. Une
   saisie inhabituelle (`https://www.github.com`) serait traitée comme une instance GHES par cette règle simple —
   cas non couvert par les critères d'acceptation, jugé négligeable (non bloquant).

---

## Ordre de réalisation suggéré
1. Exceptions communes (`ForgeRateLimitedException`) + extension de `ForgeTestResult`/`ForgeClient` (interface)
2. Déplacement de `normalizeGitlabUrl` → `modules/forges/domain/normalize-forge-url.ts` (renommage pur, tests déplacés)
3. `modules/github/domain/` (fonctions pures : `derive-github-api-bases`, `normalize-github-project-path`) + tests
4. `modules/github/mappers/` (`compute-github-merge-status`, `resolve-github-reviewers`, `map-graphql-pull-request`) + tests unitaires exhaustifs (tous les codes RG-020-09, tous les cas RG-020-08)
5. `modules/github/github-client.service.ts` (`testConnection`, `resolveProject`, `fetchOpenMergeRequests` avec pagination/retry) + tests
6. `modules/github/github.module.ts`, branchement dans `ForgeClientFactory` et `app.module.ts`
7. `projects.service.ts` : réordonnancement (`normalizePath` après résolution de connexion) + tests du nouveau code `projects.invalidPath`
8. Tests e2e (connexion GitHub, ajout de repo, chemin invalide)
9. Frontend : modèles, `connections-form.ts` (URL par défaut par type), template (radio activé, aide conditionnelle, segment de toast), placeholder du chemin par type
10. i18n (fr/en, en parallèle des clés introduites à chaque étape ci-dessus)
11. Validation manuelle en navigateur (environnement isolé) — le test de connexion et la synchronisation réels ne
    sont pas vérifiables sans jeton GitHub/GHES valide et accès réseau sortant ; se limiter à la vérification des
    états d'erreur (jeton invalide, chemin invalide) et de l'UI (radio, aide, placeholder)
