# Architecture — US-019 Connexions multi-forges (socle)

## Résumé fonctionnel
Remplacer la configuration mono-instance (« une URL GitLab + un jeton + une identité » dans `Settings`) par une liste
de **connexions** persistées immédiatement (comme les repos), chacune avec son type de forge, son jeton chiffré et
son identité « moi ». Les repos, utilisateurs et MRs deviennent rattachés à une connexion. Cette US pose le socle
`ForgeClient` réutilisé tel quel par US-020 (GitHub) ; seul `gitlab` est acceptable comme type ici.

---

## ⚠️ Décisions d'architecture nécessitant validation

Trois écarts par rapport à un simple renommage additif, requis par RG-019-05/21 mais non détaillés au niveau code
dans les specs — à valider avant le développement :

1. **`mergeStatus` calculé au mapping, pas à la lecture.** Aujourd'hui, `computeMergeStatus` (pur, mais dont les
   valeurs d'entrée sont en réalité 100 % des enums GraphQL GitLab : `CONFLICT`, `CI_STILL_RUNNING`…) est appelé à
   chaque lecture (`MergeRequestsService.toMergeStatusField`) sur 6 colonnes brutes persistées
   (`detailed_merge_status`, `conflicts`, `head_pipeline_status`, `approvals_required`, `approvals_left`,
   `resolvable/resolved_discussions_count`). RG-019-21 exige que `ForgeMergeRequest` porte un `mergeStatus`
   **déjà normalisé par un mapper propre à la forge** — donc calculé une fois, au moment du mapping GitLab → type
   commun, avant persistance. Proposition : déplacer `computeMergeStatus` dans `modules/gitlab/mappers/` (renommé
   `computeGitlabMergeStatus`, signature inchangée), l'appeler dans `mapGraphqlMergeRequest`, et remplacer les 6
   colonnes `MergeRequest` par deux colonnes génériques : `merge_status_state` (text) et `merge_status_reasons`
   (text, JSON de `MergeStatusReason[]`). `MergeRequestsService.toMergeStatusField` devient une simple lecture/parse,
   sans dépendance à `merge-requests/domain/compute-merge-status.ts` (déplacé et renommé). Un futur mapper GitHub
   (US-020) implémentera sa propre traduction des statuts GitHub Checks/Reviews vers les mêmes 11 codes.
2. **Identifiants distants en texte partout, pas seulement `users`.** RG-019-05 ne mentionne explicitement que
   `remoteUserId`, mais la même contrainte (GitHub expose des `node_id` chaînes) s'applique à `gitlabProjectId` →
   `remoteProjectId` (`Project`) et `gitlabMrId` → `remoteId` (`MergeRequest`) : les trois deviennent `text`. `iid`
   (numéro local affiché dans l'URL) reste `integer`, GitHub l'expose aussi comme tel (`number` de la PR).
3. **Contrat `ForgeClient` étendu d'une 4ᵉ méthode `normalizeUrl`.** RG-019-21 en liste 3 ; sans `normalizeUrl` dans
   le contrat, `ConnectionsService` devrait importer une fonction spécifique à GitLab pour valider une URL avant de
   savoir quel type de forge elle configure, brisant l'indépendance de forge visée. `normalizeUrl(input): string |
   null` rejoint donc `testConnection`/`resolveProject`/`fetchOpenMergeRequests` dans le contrat.

---

## Backend

### Nouveau module `modules/forges/` — le contrat

- `forge-client.interface.ts` : interface `ForgeClient` —
  `normalizeUrl(input: string): string | null`,
  `testConnection(url, token): Promise<ForgeTestResult>`,
  `resolveProject(url, token, path): Promise<ForgeProject | null>`,
  `fetchOpenMergeRequests(url, token, project: ForgeProject, opts: { deadlineAt: number }): Promise<ForgeMergeRequest[]>`.
- `types/forge-user.ts` : `ForgeUser { remoteUserId: string; username: string; name: string; avatarUrl: string | null; webUrl: string }`.
- `types/forge-project.ts` : `ForgeProject { remoteProjectId: string; pathWithNamespace: string; webUrl: string }`.
- `types/forge-merge-request.ts` : `ForgeMergeRequest` — mêmes champs que `MappedGitlabMergeRequest` actuel, avec
  `remoteId: string` (au lieu de `gitlabMrId`), `author/reviewers/assignees: ForgeUser`, et
  `mergeStatus: MergeStatusResult` (voir décision 1) au lieu des 6 champs bruts.
  `types/forge-test-result.ts` : reprend la forme de `TestConnectionResultDto` actuel (`username, name, avatarUrl,
  expiresAt, expirationKnown`), renommé forge-agnostique.
- `forge-client.factory.ts` : `ForgeClientFactory.forType(type: ConnectionType): ForgeClient` — lève
  `ForgeTypeUnsupportedException` (`forge.typeUnsupported`) pour `github` dans cette US. Providers Nest : injecte
  `GitlabClientService` (seule implémentation) via un token ou une map ; la factory est le seul point qui connaît
  la liste des forges supportées.
- Exporte `ForgeClientFactory` ; n'a **aucune** dépendance vers `settings`/`projects`/`sync`/`connections`.

### `modules/gitlab/` — devient l'implémentation GitLab du contrat

- `GitlabClientService` renommé/réorganisé pour **implémenter `ForgeClient`** directement (pas de classe
  adaptatrice séparée) : `getCurrentUser`+`getTokenInfo` fusionnés en `testConnection` (reprend le corps actuel de
  `SettingsService.testConnection`, y compris `hasRequiredScope`/`GitlabScopeException` → `ForgeScopeException`),
  `getProject` → `resolveProject`, `getOpenMergeRequests` → `fetchOpenMergeRequests` (le paramètre `project` devient
  un `ForgeProject` complet au lieu d'un `pathWithNamespace` brut, pour uniformiser la signature du contrat).
  `mapGraphqlMergeRequest` calcule désormais `mergeStatus` via `computeGitlabMergeStatus` (déplacée depuis
  `merge-requests/domain/`, voir décision 1) et retourne un `ForgeMergeRequest`.
- `domain/normalize-gitlab-url.ts` (déplacé depuis `settings/domain/`, inchangé) devient l'implémentation de
  `normalizeUrl`. `domain/check-token-scopes.ts` (déplacé depuis `settings/domain/`, inchangé) reste interne à ce
  module — les scopes acceptés (`read_api`, `api`) sont un détail GitLab.
- `domain/token-hint.ts` (déplacé depuis `settings/domain/` vers `common/crypto/` ou `common/domain/` — pur
  slicing de chaîne, aucune dépendance GitLab) devient partagé entre `ConnectionsService` et, plus tard, GitHub.
- Types REST (`gitlab-user.ts`, `gitlab-project.ts`, `gitlab-token-info.ts`) restent internes, jamais exposés
  au-delà du module.

### Nouveau module `modules/connections/` — persistance et CRUD

- **Entité `Connection`** (`connections`) : `id` (PK), `type` (text, `'gitlab'|'github'`), `name` (text, unique
  `COLLATE NOCASE` — même pattern que `Project.alias`), `url` (text, normalisée), `tokenEncrypted` (text, nullable —
  RG-019-19 : une connexion importée en v2 peut exister sans jeton), `meUsername` (text, nullable), `createdAt`,
  `updatedAt` (text).
- **Migration** `AddConnections` : crée la table, puis `MigrateSettingsToConnections` (RG-019-06) — voir §Migrations.
- `connections.service.ts` : `list()` (+ `projectsCount` par jointure/compte sur `projects`), `add(dto)` (valide
  `type === 'gitlab'` sinon `ForgeTypeUnsupportedException`, normalise l'URL via
  `ForgeClientFactory.forType(type).normalizeUrl`, vérifie l'unicité du nom insensible à la casse →
  `ConnectionNameDuplicateException` (`connections.nameDuplicate`, 400), jeton obligatoire ≥ 8 caractères, chiffre
  via `TokenCipherService`), `update(id, dto)` (jeton optionnel = inchangé, nom re-vérifié si modifié), `remove(id)`
  (cascade DB sur `projects`/`users`/`merge_requests` — voir migration), `test(dto)` (délègue à
  `ForgeClientFactory.forType(type).testConnection`, résout le jeton de `connectionId` si `token` absent),
  `getToken(connectionId): Promise<string | null>`, `getById`/`getByIdOrThrow`, `updateIdentity(connectionId,
  username)` (appelé par `SettingsService.update` pour RG-019-08).
- `connections.controller.ts` : `GET/POST/PUT/DELETE /connections`, `POST /connections/test` — contrat exact de
  RG-019-22.
- `dto/` : `CreateConnectionDto` (`type, name?, url, token`), `UpdateConnectionDto` (`name?, url?, token?`),
  `TestConnectionDto` (`type, url, token?, connectionId?`), `ConnectionResponseDto` (`id, type, name, url,
  tokenConfigured, tokenHint, meUsername, projectsCount`).
- `domain/normalize-connection-name.ts` : dérive le nom par défaut depuis l'hôte de l'URL sans `www.` (RG-019-02) —
  fonction pure, testée isolément.
- Importe `ForgesModule`, `TokenCipherService` (`CryptoModule`). N'importe **pas** `SettingsModule` (pas de
  dépendance cyclique : c'est `SettingsModule` qui importera `ConnectionsModule`, jamais l'inverse).

### Migrations (ordre)

1. `AddConnections` — crée `connections`.
2. `MigrateSettingsToConnections` (RG-019-06) — logique dans le fichier de migration (SQL direct, pas de
   dépendance aux services Nest, comme les migrations existantes) :
   - Si `settings.gitlab_token_encrypted IS NOT NULL` OU `EXISTS (SELECT 1 FROM projects)` : insère une connexion
     `type='gitlab', name='GitLab', url=settings.gitlab_url, token_encrypted=settings.gitlab_token_encrypted,
     me_username=settings.me_username`.
   - Sinon (installation vierge) : aucune connexion créée.
   - Ajoute `projects.connection_id` (FK, cascade), `users.connection_id` (FK, cascade), `merge_request.remote_id`
     type text, `projects.remote_project_id` type text, `users.remote_user_id` type text — toutes ces colonnes
     nécessitent une reconstruction de table sous SQLite (pas d'`ALTER COLUMN` ni d'ajout de FK a posteriori) :
     suivre le pattern déjà utilisé par `1757600400000-AllowNullDiffStats.ts` (recréation de table + copie +
     bascule). Remplit `connection_id` sur `projects`/`users` avec l'id de la connexion créée ci-dessus (ou ne crée
     aucune ligne si l'installation est vierge, auquel cas ces tables sont déjà vides).
   - Supprime `settings.gitlab_url`, `settings.gitlab_token_encrypted`, `settings.me_username` (reconstruction de
     table `settings`, même pattern) ; conserve `settings.me_email`.
3. `AddMergeStatusColumns` — ajoute `merge_requests.merge_status_state`/`merge_status_reasons`, backfill depuis les
   6 colonnes existantes via l'ancien `computeMergeStatus` (en SQL ce n'est pas raisonnable : préférer un script de
   migration TypeORM en JS qui relit chaque ligne, calcule et réécrit — pattern déjà vu pour des migrations de
   données dans ce projet ; si aucun précédent exact n'existe, le signaler en revue), puis supprime les 6 colonnes.
   Peut être fusionnée avec l'étape 2 en une seule migration si le dev juge la séparation artificielle.

### Impacts sur le modèle de données (résumé)

| Entité | Colonnes ajoutées | Colonnes supprimées/renommées |
|--------|-------------------|-------------------------------|
| `Settings` | — | `gitlabUrl`, `gitlabTokenEncrypted`, `meUsername` supprimées |
| `Connection` (nouvelle) | `id, type, name, url, tokenEncrypted, meUsername, createdAt, updatedAt` | — |
| `Project` | `connectionId` (FK cascade) | `gitlabProjectId` → `remoteProjectId` (text) |
| `User` | `connectionId` (FK cascade) | `gitlabUserId` → `remoteUserId` (text) ; unicité (`connectionId`, `remoteUserId`) |
| `MergeRequest` | `mergeStatusState`, `mergeStatusReasons` (JSON) | `gitlabMrId` → `remoteId` (text) ; suppression de `detailedMergeStatus`, `conflicts`, `headPipelineStatus`, `approvalsRequired`, `approvalsLeft`, `resolvableDiscussionsCount`, `resolvedDiscussionsCount` |

Unicité repos : (`connectionId`, `pathWithNamespace`) insensible à la casse (RG-019-04) — `alias` reste unique
globalement (inchangé).

### Intégration dans les modules existants

- **`SettingsModule`** : perd `GitlabModule` (plus aucun accès GitLab direct — `POST /settings/test-connection`
  supprimé, RG-019-22). Importe `ConnectionsModule`. `SettingsService` perd `getGitlabUrl`, `getToken`,
  `testConnection`, les champs `gitlabUrl`/`gitlabTokenEncrypted`/`meUsername` de `ExportableSettings`/
  `MergeableSettingsFields`/`toResponse` (RG-019-23). Gagne `update()` qui, après avoir mergé les champs globaux,
  itère `dto.identities` et appelle `connections.updateIdentity(id, username)` pour chacun (RG-019-08).
  `getIdentity()` global est supprimé ; remplacé par la résolution par connexion dans `MergeRequestsService`
  (décision déjà actée par RG-019-25).
- **`UpdateSettingsDto`** : retire `extends GitlabCredentialsDto` (plus de `gitlabUrl`/`gitlabToken` ici) ; ajoute
  `identities?: IdentityDto[]` avec `IdentityDto { connectionId: number; username: string }`
  (`@ValidateNested({ each: true })`). `SettingsResponseDto` retire `gitlabUrl`, `tokenConfigured`, `tokenHint`,
  `meUsername`.
- **`ProjectsModule`** : remplace `SettingsModule`+`GitlabModule` par `ConnectionsModule`+`ForgesModule`.
  `ProjectsService.add(dto)` prend un `connectionId` (`CreateProjectDto.connectionId?`, obligatoire si ≥ 2
  connexions — validation en service, pas en DTO, car elle dépend du nombre de connexions existantes ; message
  d'erreur dédié si absent alors que requis). Résout la connexion, son jeton (`connections.getToken`), son forge
  client (`forges.forType(connection.type)`), appelle `resolveProject`. `assertProjectNotConfigured` scope sa
  vérification à `(connectionId, remoteProjectId)`. `MissingConfigurationException('settings.tokenMissing')` →
  deux cas distincts (RG-019-15) : aucune connexion → `connections.missing` (409) ; connexion sans jeton →
  `connections.tokenMissing` (409).
- **`SyncModule`/`SyncService`** : remplace l'itération plate `projects.listActive()` par une itération à deux
  niveaux (RG-019-16) : `connections.list()` (entités internes, pas le DTO) → pour chaque connexion, ses repos actifs
  (`projects.listActiveByConnection(connectionId)`, nouvelle méthode) → jeton/URL/forge client résolus une fois par
  connexion. Une connexion sans jeton : tous ses repos échouent avec `Aucun jeton (<nom>)` sans appel réseau ; un
  jeton refusé (`ForgeAuthException`) : `Jeton refusé (<nom>)`. `summarize-sync-run.ts` doit préfixer chaque message
  du nom de connexion (petit ajustement de sa signature ou de l'appelant).
- **`MergeRequestsModule`/`MergeRequestsService`** : ajoute `ConnectionsModule`. `loadBase` résout désormais, en
  plus de `projectsById`, un `connectionsById: Map<number, Connection>` (via `connections.findByIds`, nouvelle
  méthode interne symétrique à `ProjectsService.findByIds`) et le `meEmail` global (`settings.getMeEmail()`,
  remplace `settings.getIdentity()`). Pour chaque MR, l'identité passée à `toMergeRequestView` devient `{ username:
  connectionsById.get(project.connectionId)?.meUsername ?? null, email: meEmail }` — résolue **par MR** (RG-019-25),
  plus une seule fois pour toute la réponse. `mineOnly` sans **aucune** connexion ayant de username reste le seul
  cas de warning `identity.missing` (RG-019-09 : vérifié sur toutes les connexions, pas sur une identité globale).
  `MergeRequestViewDto` gagne `connection: { id: number; name: string; type: ConnectionType }` (RG-019-22).
  `toMergeStatusField` devient un simple parse des 2 colonnes génériques (décision 1).
- **`SettingsTransferModule`/`SettingsTransferService`** : ajoute `ConnectionsModule`. `export()` : `version: 2`,
  `settings` = `ExportableSettings` sans identités (déjà le cas après RG-019-23), `connections:
  [{ type, name, url, meUsername }]` (jamais le jeton), `projects: [{ connection: <name>, pathWithNamespace, alias
  }]`. `import()` : distingue `version` 1 (convertit en une connexion « GitLab » unique, comme RG-019-06, sans
  jeton — RG-019-19) et `version: 2` (fusion par nom insensible à la casse ; nouvelles connexions créées sans jeton
  ; repos rattachés par nom → `connections.unknown` si introuvable, `connections.tokenMissing` si la connexion
  cible n'a pas de jeton — ces deux raisons rejoignent le `skipped[].reason` déjà existant de `ImportProjectsResult`).
  `ImportConfigDto`/`ImportSettingsDto`/`ImportProjectDto` : `ImportConnectionDto` nouveau (`type, name, url,
  meUsername?`), `ImportProjectDto.connection: string` remplace l'absence actuelle de champ (les repos v1 sont
  rattachés à la connexion unique migrée). Gérer les deux versions dans le même service via une branche explicite
  `dto.version === 1 ? importV1(dto) : importV2(dto)`.
- **`common/exceptions/business.exception.ts`** : `GitlabAuthException` → `ForgeAuthException` (code `forge.auth`),
  `GitlabScopeException` → `ForgeScopeException` (`forge.scope`), `GitlabUnavailableException` →
  `ForgeUnavailableException` (`forge.unavailable`), `GitlabTimeoutException` → `ForgeTimeoutException`
  (`forge.timeout`) — RG-019-21. Ajoute `ForgeTypeUnsupportedException` (400, `connections.typeUnsupported`),
  `ConnectionNameDuplicateException` (400, `connections.nameDuplicate`), `ConnectionMissingException` (409,
  `connections.missing`), `ConnectionTokenMissingException` (409, `connections.tokenMissing`).
- **`app.module.ts`** : ajoute `ForgesModule`, `ConnectionsModule` (avant `ProjectsModule`/`MergeRequestsModule`
  dans la liste, par cohérence avec l'ordre de dépendance).

### Contrat API

Reprend exactement le tableau de RG-019-22 (§3 des specs) : `GET/POST/PUT/DELETE /connections`, `POST
/connections/test`, `PUT /settings` (+ `identities?`, − `gitlabUrl/gitlabToken/meUsername`), `POST /projects` (+
`connectionId?`), `GET /merge-requests` (+ `connection` par MR). `POST /settings/test-connection` supprimé (aucun
alias déprécié, QO-019-04).

### Nouvelles tâches techniques (backend)

| Tâche | Type | Description |
|-------|------|-------------|
| `modules/forges/forge-client.interface.ts` + `types/*.ts` | Contrat | Voir ci-dessus |
| `modules/forges/forge-client.factory.ts` (+ `.spec.ts`) | Service | Sélection par `type`, lève `ForgeTypeUnsupportedException` pour `github` |
| `modules/forges/forges.module.ts` | Module | Exporte la factory |
| Réécrire `gitlab-client.service.ts` pour implémenter `ForgeClient` (+ tests existants adaptés) | Service | Renommage de méthodes, ajout `normalizeUrl`, retour de `ForgeMergeRequest`/`ForgeProject`/`ForgeUser` |
| Déplacer + renommer `compute-merge-status.ts` → `gitlab/mappers/compute-gitlab-merge-status.ts` (+ `.spec.ts` déplacé) | Fonction pure | Voir décision 1 |
| `modules/connections/entities/connection.entity.ts` | Entité | Voir ci-dessus |
| `modules/connections/connections.service.ts` (+ `.spec.ts`) | Service | CRUD + test + résolution jeton/identité |
| `modules/connections/connections.controller.ts` (+ `.spec.ts`) | Controller | RG-019-22 |
| `modules/connections/dto/*.ts` | DTOs | `Create/Update/TestConnectionDto`, `ConnectionResponseDto` |
| `modules/connections/domain/normalize-connection-name.ts` (+ `.spec.ts`) | Fonction pure | RG-019-02 |
| `modules/connections/connections.module.ts` | Module | — |
| Migration `AddConnections` | Migration | — |
| Migration `MigrateSettingsToConnections` | Migration | RG-019-06, voir §Migrations |
| Migration `AddMergeStatusColumns` (ou fusionnée) | Migration | Voir décision 1 |
| `test/connections.e2e-spec.ts` | Test e2e | Couvre les scénarios Gherkin CRUD/test/suppression |
| `test/migrate-settings-to-connections.e2e-spec.ts` ou test dédié | Test e2e/intégration | Scénarios « Migration », « Installation vierge », « Préférences globales non affectées » |

### Modifications sur l'existant (backend)

| Élément modifié | Nature | Risque | Solution proposée |
|-----------------|--------|--------|-------------------|
| `settings.entity.ts`, `settings.service.ts`, `update-settings.dto.ts`, `settings-response.dto.ts` | Suppression de 3 champs, ajout `identities` | Élevé (beaucoup d'US ont touché ce fichier) | Suivre RG-019-23 à la lettre ; ne toucher à aucun autre champ |
| `project.entity.ts`, `projects.service.ts`, DTOs projet | Ajout `connectionId`, renommage `gitlabProjectId` | Élevé (fichier central) | Traiter `remoteProjectId` comme un renommage pur (garder tous les autres comportements RG-003-*) |
| `user.entity.ts`, `users.service.ts` | Ajout `connectionId`, renommage, `upsert(connectionId, user)` | Moyen | `upsert` prend désormais `connectionId` en premier paramètre |
| `merge-request.entity.ts`, `merge-requests.service.ts` | Renommage + remplacement des 6 colonnes mergeStatus | Élevé | Voir décision 1 ; tests `compute-merge-status.spec.ts` déplacés doivent continuer à passer tels quels (fonction pure inchangée) |
| `is-mine.ts` | Aucun changement de code (RG-019-25) | Faible | L'appelant seul change ; le test existant reste valide tel quel |
| `sync.service.ts` | Boucle à deux niveaux, messages préfixés | Moyen | Isoler la résolution jeton/forge-client par connexion dans une méthode privée dédiée |
| `settings-transfer.service.ts` | `export`/`import` v2 + compat v1 | Moyen | Brancher explicitement sur `dto.version` |
| `common/exceptions/business.exception.ts` | Renommage de 4 classes | Élevé (beaucoup de call-sites) | Un grep global de chaque nom avant renommage (`GitlabAuthException` etc.) |
| `frontend/public/i18n/{fr,en}.json` clé `errors.gitlab.*` | Renommage `errors.forge.*` | Élevé (RG-019-26) | Renommer dans les deux fichiers dans le même commit |

---

## Frontend

### Intégration dans les features existantes

Tout reste dans `features/settings/`. Nouvelle sous-feature `features/settings/sections/connections/` remplaçant
`sections/gitlab-connection/`. `sections/me/` et `sections/repositories/` sont adaptées (pas déplacées).

### Composants réutilisables et Angular Material

| Composant | Origine | Usage prévu |
|-----------|---------|-------------|
| Tableau compact (style du tableau repos existant) | `sections/repositories` (pattern, pas un composant partagé) | Liste des connexions (RG-019-10) |
| `ConfirmDialogComponent` | `shared/confirm-dialog` | Suppression d'une connexion (RG-019-13) |
| `mat-radio-group` | Angular Material (déjà utilisé section 04/thresholds) | Type de connexion (RG-019-11) |
| `mat-select` | Angular Material (nouveau dans ce contexte) | Sélecteur de connexion sur la ligne d'ajout de repo (RG-019-15) |
| Icônes Lucide `gitlab`/`github` | `shared/icons/provide-icons.ts` | À ajouter à `ICONS` (absentes actuellement) |
| `AvatarComponent` | `shared/avatar` | Aperçu d'identité par ligne « Moi » (inchangé, réutilisé N fois) |

### Nouveaux modèles TypeScript

- `models/connection.model.ts` : `ConnectionType = 'gitlab' | 'github'`, `Connection { id, type, name, url,
  tokenConfigured, tokenHint, meUsername, projectsCount }`, `CreateConnectionRequest { type, name?, url, token }`,
  `UpdateConnectionRequest { name?, url?, token? }`, `TestConnectionRequest { type, url, token?, connectionId? }`
  (remplace l'actuel dans `settings.model.ts`, plus générique), `TestConnectionResult` (inchangé structurellement,
  déplacé ici).
- `models/settings.model.ts` : `Settings` perd `gitlabUrl, tokenConfigured, tokenHint, meUsername`. `Identity {
  connectionId: number; username: string }`. `UpdateSettingsRequest` perd `gitlabUrl?, gitlabToken?, meUsername?`,
  gagne `identities?: Identity[]`. `ExportConfig.version: 2`, `settings` sans les champs supprimés, `connections:
  ExportedConnection[]` (`{ type, name, url, meUsername }`), `projects: TransferProject & { connection: string }`.
  `ImportConfig` symétrique, accepte aussi la forme v1 côté type (`version: 1 | 2`).
- `models/project.model.ts` : `Project.gitlabProjectId: number` → `remoteProjectId: string` ; ajoute
  `connectionId: number`. `CreateProjectRequest` gagne `connectionId?`.
- `models/merge-request.model.ts` : `MergeRequestView` gagne `connection: { id: number; name: string; type:
  ConnectionType }`.

### Nouveaux services/stores

- `core/api/connections.service.ts` (miroir de `projects.service.ts`) : `getConnections`, `postConnection`,
  `putConnection`, `deleteConnection`, `postTestConnection`.
- `stores/connections.store.ts` (miroir exact de `stores/projects.store.ts`) : `connections: Connection[], loading,
  loadError, saving`, actions `load/add/update/remove/test` — `test` peut réutiliser le même `TestConnectionState`
  que `SettingsStore.test` (déplacer ce type dans `connection.model.ts` ou un fichier partagé, puisqu'il n'est plus
  spécifique à `SettingsStore`).

### Sections à réécrire/adapter

- **`sections/connections/` (nouvelle, remplace `sections/gitlab-connection/`)** : composant hybride comme
  `RepositoriesSectionComponent` — persistance immédiate via `ConnectionsStore`, pas de lien avec le formulaire
  global `SettingsForm`. Contient la liste (RG-019-10) et le formulaire inline ajout/modification (RG-019-11,
  état local `editingId: number | null` ou `null` = fermé, `'new'` = création). Toasts propres (RG-019-12). Voir
  `design.md` pour le détail visuel.
- **`sections/me/`** : `MeSectionComponent` reçoit désormais `identities: input.required<{ connection: Connection;
  identity: MeIdentity }[]>` au lieu d'un unique `identity`. Template : une ligne par connexion (username + aperçu
  RG-002-03 par ligne) + le champ email global + la case `highlightMe` (inchangée, RG-019-24). État vide (aucune
  connexion) : message + lien vers la section connexions (RG-019-08).
- **`me-identity.ts`** : `resolveMeIdentity` prend maintenant `(username: string, test: TestConnectionState |
  undefined)` par connexion — signature quasi inchangée, mais appelée en boucle par la page (une fois par
  connexion, avec le `test` de **cette** connexion si un test vient d'y être lancé depuis la section 02).
- **`settings-form.ts`** : retire les contrôles `gitlabUrl`, `gitlabToken`, `meUsername` ainsi que
  `gitlabUrlValidator`/`tokenLengthValidator`/`TOKEN_MIN_LENGTH`/`DEFAULT_GITLAB_URL` (déplacés vers
  `connections`/`connections-form.ts`, nouveau fichier miroir de `repos-form.ts`). Ajoute un `FormArray` `identities`
  (un `FormGroup<{ connectionId: FormControl<number>; username: FormControl<string> }>` par connexion, synchronisé
  par un effect de la page comme `repos` l'est déjà avec `syncReposFormArray` — nouvelle fonction
  `syncIdentitiesFormArray`, même pattern). `toUpdateRequest` ajoute `identities` depuis ce `FormArray`.
  `resetSettingsForm`/`resetSettingsFormToDefaults` ne touchent plus aux 3 champs supprimés.
- **`sections/repositories/`** : `addForm` gagne un contrôle `connectionId` (actif seulement si
  `connectionsStore.connections().length > 1`, sinon implicite = l'unique connexion, RG-019-15). Template : `mat-
  select` conditionnel + placeholder du champ chemin dépendant du type de la connexion sélectionnée. Tableau : colonne
  « Connexion » conditionnelle (`*ngIf`/`@if` sur le même critère). `RepoRow` inchangé structurellement.
- **`settings-page.component.ts`** : retire les effects/logique liés à `gitlabUrl`/`gitlabToken`/`canTest`/
  `testConnection` (déplacés dans la nouvelle section connexions, qui gère son propre test comme
  `RepositoriesSectionComponent` gère son propre ajout). Ajoute `protected readonly connectionsStore =
  inject(ConnectionsStore)`, `ngOnInit` appelle aussi `connectionsStore.load()`. `meIdentity` devient un
  `computed()` retournant un tableau `{ connection, identity }[]` zippé sur `connectionsStore.connections()` et le
  nouveau `FormArray identities`. `boardQueryParams` inchangé.
- **`shared/icons/provide-icons.ts`** : ajoute les entrées `gitlab` et `github` (SVG Lucide 16 px, `neutral-600`
  porté par le CSS appelant comme les autres icônes) — chercher les tracés officiels Lucide (`gitlab`, `github`)
  pour rester cohérent avec le reste de `ICONS`.

### Modifications sur l'existant (frontend)

| Élément modifié | Nature | Risque | Solution proposée |
|-----------------|--------|--------|-------------------|
| `settings.model.ts` | Suppression de champs | Élevé (beaucoup de fichiers les lisent) | Grep `gitlabUrl`, `tokenConfigured`, `tokenHint`, `meUsername` sur tout `frontend/src` avant de commencer |
| `settings-form.ts`, `settings-page.component.ts`, `me-section`, `me-identity.ts` | Refonte identité multi-connexion | Élevé | Traiter comme une réécriture complète de la section 01/02, pas un patch |
| `repositories-section.component.ts/.html` | Ajout conditionnel sélecteur + colonne | Moyen | Le rendu conditionnel double le nombre de cas à tester (1 vs ≥2 connexions) |
| `frontend/public/i18n/fr.json` clé `settings.connection.*` | Renommée `settings.connections.*`, restructurée en liste + formulaire | Élevé (RG-019-26) | Voir §i18n |
| `frontend/public/i18n/en.json` (miroir) | Idem | Élevé | Jamais un renommage dans un seul fichier |
| `dictionary-parity.spec.ts` | Aucune modification de code, mais échoue si oubli | — | Lancer ce test en dernier avant de livrer |

### Clés i18n (structure attendue)

Renommer `settings.connection.*` → `settings.connections.*` et restructurer :
`settings.connections.{number,title,description}` (RG-019-10, "02 · Connexions"),
`settings.connections.empty` ("Aucune connexion..."),
`settings.connections.add` ("+ Ajouter une connexion"),
`settings.connections.list.{tokenConfigured,tokenNone,test,edit,remove}`,
`settings.connections.form.{type,typeGitlab,typeGithub,typeGithubSoon,name,nameDuplicate,url,urlRequired,urlInvalid,token,tokenKeepPlaceholder,tokenTooShort,showToken,hideToken,test,testing,confirm,cancel}`,
`settings.connections.result.*` (reprend `connected/expires/noExpiry/unknownExpiry` tel quel),
`settings.connections.deleteConfirm.{title,message,confirm,cancel}` (RG-019-13),
`settings.connections.added/updated/removed` (toasts RG-019-12).
`settings.me.usernameFor` (`"Nom d'utilisateur sur {{connection}}"`, RG-019-08), `settings.me.noConnection`
("Ajoutez d'abord une connexion", RG-019-08).
`settings.projects.connection` (en-tête de colonne), `settings.projects.connectionPlaceholder` (label du sélecteur).
`errors.forge.*` reprend `errors.gitlab.*` (auth/unavailable/scope) + `timeout`.
`errors.connections.*` : `nameDuplicate, typeUnsupported, missing, tokenMissing, unknown`.

---

## Points de vigilance globaux

- **Ampleur du renommage `Gitlab* → Forge*`.** Le renommage des exceptions et des identifiants distants touche des
  dizaines de fichiers déjà couverts par des tests existants (US-004, US-017). Faire ce renommage en premier, seul,
  avant toute logique nouvelle, et relancer toute la suite de tests immédiatement après pour isoler les régressions
  de renommage des régressions fonctionnelles.
- **Migration destructive irréversible.** `MigrateSettingsToConnections` supprime des colonnes ; à tester
  impérativement sur une copie de base réelle (pas seulement SQLite `:memory:` des tests e2e) avant toute mise en
  production, conformément à la pratique déjà suivie dans ce projet pour les migrations précédentes.
- **`ForgeClientFactory` ne doit dépendre d'aucun module métier.** Le risque principal de régression future
  (US-020) est un couplage caché entre `forges` et `connections`/`projects` qui empêcherait d'ajouter GitHub sans
  toucher au socle — vérifier en revue qu'aucun import ne remonte dans ce sens.
- **Performance de `loadBase`.** La résolution d'identité par MR (au lieu d'une fois pour toute la réponse) reste
  O(1) par MR grâce à la map `connectionsById` déjà chargée en une seule requête — pas de N+1 à surveiller.
- **`ProjectsService.importMany`** (US-015) doit maintenant router chaque entrée vers la bonne connexion par nom —
  vérifier que le comportement additif (jamais de suppression) et le `skipped[]` existants restent inchangés pour
  la connexion déjà résolue, seule la résolution de `connectionId` est nouvelle.

---

## Ordre de réalisation suggéré

1. Renommage `Gitlab*Exception` → `Forge*Exception` (+ i18n `errors.forge.*`) — isolé, revalidé seul.
2. `modules/forges/` (contrat + factory, testés avec un stub `ForgeClient`).
3. `modules/gitlab/` réécrit pour implémenter `ForgeClient` (y compris déplacement de `compute-merge-status.ts`).
4. Migrations : `AddConnections`, `MigrateSettingsToConnections`, `AddMergeStatusColumns`.
5. `modules/connections/` (entité, service, controller, DTOs) + tests unitaires/e2e.
6. Adaptation `SettingsModule` (retrait gitlab, ajout `identities`), `ProjectsModule`, `SyncModule`,
   `MergeRequestsModule`, `SettingsTransferModule` — un module à la fois, tests relancés à chaque étape.
7. Frontend : modèles, `ConnectionsService`/`ConnectionsStore`.
8. Frontend : `sections/connections/` (liste + formulaire inline).
9. Frontend : `sections/me/` multi-identité, `settings-form.ts`, `settings-page.component.ts`.
10. Frontend : `sections/repositories/` (sélecteur + colonne conditionnels).
11. i18n (`fr.json`/`en.json` en un seul commit) + `dictionary-parity.spec.ts`.
12. Validation manuelle complète des 20 scénarios Gherkin de la spec, en particulier migration sur base réelle.
