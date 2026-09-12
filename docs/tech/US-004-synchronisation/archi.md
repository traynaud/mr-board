# Architecture — US-004 Synchronisation des MRs depuis GitLab

## Résumé fonctionnel
Le backend récupère par GraphQL, pour chaque repo configuré, les MRs ouvertes et leurs métadonnées, les persiste
localement (upsert/suppression, `ready_at` stable), et expose un statut de synchronisation consommé par une toolbar
enrichie sur l'écran Tableau (statut, bouton Rafraîchir, bandeau sans-jeton, état vide).

---

## Backend

### Impacts sur le modèle de données

**Nouvelles entités**

| Entité | Table | Colonnes | Contraintes / index |
|---|---|---|---|
| `User` (`modules/users/entities/user.entity.ts`) | `users` | `id` PK auto, `gitlab_user_id` integer, `username` text, `name` text, `avatar_url` text nullable, `web_url` text | Unique `gitlab_user_id` |
| `MergeRequest` (`modules/merge-requests/entities/merge-request.entity.ts`) | `merge_requests` | `id` PK auto, `gitlab_mr_id` integer, `iid` integer, `project_id` integer FK → `projects.id` `ON DELETE CASCADE`, `title` text, `web_url` text, `draft` boolean, `author_id` integer FK → `users.id`, `approved` boolean, `comments_count` integer, `changed_files` integer, `additions` integer, `deletions` integer, `labels` text (JSON `string[]`), `created_at_gitlab` text, `ready_at` text nullable, `updated_at_gitlab` text, `synced_at` text | Unique (`project_id`, `iid`) ; index sur `project_id`, `ready_at`, `draft` (déjà prévus dans `architecture-backend.md`) |
| `MergeRequestReviewer` (`modules/merge-requests/entities/merge-request-reviewer.entity.ts`) | `merge_request_reviewers` | `merge_request_id` FK → `merge_requests.id` `ON DELETE CASCADE`, `user_id` FK → `users.id` | PK composite (`merge_request_id`, `user_id`) |
| `MergeRequestAssignee` (`modules/merge-requests/entities/merge-request-assignee.entity.ts`) | `merge_request_assignees` | Idem `MergeRequestReviewer` | PK composite (`merge_request_id`, `user_id`) |
| `SyncRun` (`modules/sync/entities/sync-run.entity.ts`) | `sync_runs` | `id` PK auto, `started_at` text, `finished_at` text, `status` text (`success`\|`partial`\|`error`), `error_message` text nullable, `mr_count` integer, `trigger` text (`manual`\|`scheduled`) | Index sur `started_at` (lecture de la dernière ligne par tri) |

Un `SyncRun` n'est écrit qu'une fois la synchronisation terminée (le flag `running` de `GET /sync/status` vient du
verrou en mémoire de `SyncService`, pas d'une ligne en base) — voir §Module Sync.

**Migration** : `1757600300000-CreateMergeRequestsAndSync.ts` — crée dans l'ordre `users`, `merge_requests` (FK vers
`projects` et `users`), `merge_request_reviewers`, `merge_request_assignees`, `sync_runs`. SQL brut, cohérent avec les
3 migrations existantes.

### Intégration dans les modules existants

- **`GitlabClientService`** (module `gitlab`, inchangé dans son rôle) : nouvelle méthode
  `getOpenMergeRequests(baseUrl, token, pathWithNamespace, deadlineAt)` (voir détail ci-dessous). Nouveaux types
  `gitlab/types/gitlab-merge-request.ts` (forme brute du nœud GraphQL) et mapper pur
  `gitlab/mappers/map-graphql-merge-request.ts` (GID → id numérique, aplatissement `labels.nodes`/`reviewers.nodes`).
- **`SettingsService`** : réutilisé tel quel (`getGitlabUrl()`, `getToken()`) par `SyncService`, aucune modification.
- **`ProjectsService`/`Project`** : réutilisés tel quel (liste des repos actifs, résolution d'un `projectId`) ; aucune
  modification. La suppression en cascade des MRs d'un repo supprimé (mentionnée comme différée dans le commentaire
  de `ProjectsService.remove()`) est désormais assurée par la contrainte `ON DELETE CASCADE` de la migration
  ci-dessus — pas de changement de code dans `ProjectsService`.
- **Nouveaux modules** : `UsersModule`, `MergeRequestsModule`, `SyncModule`, tous ajoutés aux `imports` de
  `AppModule` (après `SettingsModule`, `ProjectsModule`).

#### Module `users`

- `UsersService.upsert(gitlabUser: MappedGitlabUser): Promise<User>` — upsert par `gitlab_user_id` (find puis
  save, ou `save` avec `id` retrouvé). Appelé par `MergeRequestsService` pour l'auteur, chaque reviewer, chaque
  assignee. Exporté par `UsersModule`.

#### Module `merge-requests` (persistance uniquement — pas de controller dans cette US)

- `domain/resolve-ready-at.ts` — fonction pure implémentant **exactement** la table de transition RG-004-04 :
  `resolveReadyAt(params: { existing: { draft: boolean; readyAt: string | null } | null; incomingDraft: boolean;
  gitlabCreatedAt: string; now: string }): string | null`. Testée pour les 6 cas de la table + cas limite
  "jamais vue".
- `MergeRequestsService.upsertForProject(projectId: number, mrs: MappedGitlabMergeRequest[], now: string): Promise<number>`
  — pour chaque MR : upsert des utilisateurs (auteur/reviewers/assignees) via `UsersService`, recherche de la MR
  existante par (`project_id`, `iid`), calcul de `ready_at` via `resolveReadyAt`, `save` de la ligne, puis
  remplacement intégral des lignes `merge_request_reviewers`/`merge_request_assignees` de cette MR (delete puis
  insert, RG-004-02). Retourne le nombre de MRs traitées.
- `MergeRequestsService.deleteMissing(projectId: number, keepIids: number[]): Promise<void>` — supprime les
  `merge_requests` de ce projet dont l'`iid` n'est pas dans `keepIids` (RG-004-03). Les lignes
  `merge_request_reviewers`/`merge_request_assignees` associées disparaissent via `ON DELETE CASCADE`.
- Exporté par `MergeRequestsModule` pour être consommé par `SyncModule`.

#### Module `sync`

- **Verrou et déclenchement** — `SyncService` porte un champ privé `running: boolean` (mémoire process, RG-004-05,
  RG-G16) :
  - `trigger(trigger: 'manual' | 'scheduled', projectId?: number): Promise<{ running: true }>` : si `projectId` est
    fourni, vérifie son existence (`EntityNotFoundException` → 404, avant tout retour) ; si une synchro est déjà en
    cours, retourne immédiatement `{ running: true }` sans rien démarrer ; sinon pose le verrou, lance `run(...)`
    **sans l'attendre** (`void this.run(...).finally(() => { this.running = false })`) et retourne aussitôt
    `{ running: true }`. C'est ce qui permet à la route de répondre 202 sans bloquer sur la durée réelle de la
    synchronisation.
  - `run(trigger, projectId?)` (privé) : résout la liste des projets ciblés (un seul ou tous les `enabled`) ; si
    aucun jeton configuré, écrit directement un `sync_run` `status: 'error'` (clé `settings.tokenMissing`) sans
    appeler GitLab (évite un échec par projet identique et inutile) ; sinon traite les projets **séquentiellement**
    (RG-004-05) dans un `try/catch` par projet (RG-004-07) : succès → upsert + delete-missing via
    `MergeRequestsService` ; échec (auth, indisponibilité, timeout, 429 persistant) → capturé, projet marqué en
    échec avec sa cause, **aucun** appel à `deleteMissing` pour ce projet (RG-004-03). À la fin, agrège les
    résultats via `domain/summarize-sync-run.ts` et sauvegarde le `SyncRun`. Le tout est enveloppé dans un
    `try/catch/finally` de plus haut niveau pour qu'une erreur inattendue écrive tout de même un `sync_run` en échec
    et relâche le verrou (`finally` sur `trigger`).
  - `domain/summarize-sync-run.ts` — fonction pure : entrée = résultats par projet
    (`{ projectAlias: string; success: boolean; mrCount?: number; errorMessage?: string }[]`), sortie =
    `{ status: 'success' | 'partial' | 'error'; mrCount: number; errorMessage: string | null }` (RG-004-06 :
    résumé texte listant les repos en échec, QO-004-05 close en ce sens).
- **Statut** — `getStatus(): Promise<{ running: boolean; lastRun: SyncRunDto | null; nextRunAt: null }>` : `running`
  lu depuis le champ mémoire, `lastRun` = dernière ligne `sync_runs` par `started_at` desc, mappée en DTO.
- **`GitlabClientService.getOpenMergeRequests`** — détail du comportement (RG-004-01, RG-004-13, RG-004-14) :
  - Requête GraphQL `POST {baseUrl}/api/graphql`, header `PRIVATE-TOKEN` (déjà utilisé en REST, accepté par GitLab
    en GraphQL), body `{ query, variables: { fullPath, cursor } }`. Champs demandés par nœud : `id` (GID, pour en
    extraire l'identifiant numérique `gitlab_mr_id`), `iid`, `title`, `webUrl`, `draft`, `createdAt`, `updatedAt`,
    `userNotesCount`, `approved`, `labels { nodes { title } }`, `diffStatsSummary { fileCount additions deletions }`,
    `author { username name avatarUrl webUrl }`, `reviewers { nodes { username name avatarUrl webUrl } } }`,
    `assignees { nodes { ... } }` ; pagination par curseur (`pageInfo { hasNextPage endCursor }`), taille de page
    100 (`first: 100`, cohérent avec `per_page=100` en REST).
  - Boucle de pages jusqu'à `hasNextPage: false` ou dépassement du `deadlineAt` (horodatage passé par
    `SyncService`, calculé comme `now + 60_000`, RG-004-14) : au dépassement, lève `GitlabTimeoutException` (nouvelle
    exception, voir ci-dessous), capturée par le `try/catch` par projet de `SyncService.run`.
  - Réponse HTTP `429` : lit `Retry-After` (secondes), attend cette durée plafonnée à 30 s (RG-004-13), réessaie
    **une seule fois** cette page ; un second `429` fait échouer le projet (propagation de l'exception).
  - `401`/`403` → `GitlabAuthException` (réutilisée telle quelle, message "Jeton GitLab refusé" déjà porté par la
    classe existante).
  - Timeout réseau par requête : `AbortSignal.timeout` sur la valeur restante entre maintenant et `deadlineAt`,
    plafonnée à `GITLAB_TIMEOUT_MS` (15 s, inchangé) — pas une nouvelle constante, juste `Math.min`.
  - Nouvelle exception `GitlabTimeoutException` dans `common/exceptions/business.exception.ts` (code
    `gitlab.timeout`, 502, sur le modèle de `GitlabUnavailableException`), exportée depuis `common/exceptions/index.ts`.

### Contrat API

| Méthode | Route | Body / Query | Réponse | Codes |
|---------|-------|---------------|---------|-------|
| POST | `/api/v1/sync` | `?projectId=<id>` optionnel | `{ running: true }` | 202, 404 si `projectId` inconnu |
| GET | `/api/v1/sync/status` | — | `{ running: boolean, lastRun: SyncRunDto \| null, nextRunAt: null }` | 200 |

`SyncRunDto` : `{ startedAt: string; finishedAt: string; status: 'success' | 'partial' | 'error'; mrCount: number;
errorMessage: string | null; trigger: 'manual' | 'scheduled' }` (`dto/sync-run.dto.ts`, `dto/sync-status-response.dto.ts`).

Conforme à `specs.md` §4 : aucune autre erreur métier sur `POST /sync` que le 404 sur `projectId` inconnu.

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Créer migration `1757600300000-CreateMergeRequestsAndSync` | Migration | `users`, `merge_requests`, `merge_request_reviewers`, `merge_request_assignees`, `sync_runs` + index + FK cascade |
| Créer `User` entity | Entité TypeORM | `modules/users/entities/user.entity.ts` |
| Créer `UsersService.upsert` | Service | `modules/users/users.service.ts` + spec |
| Créer `MergeRequest`, `MergeRequestReviewer`, `MergeRequestAssignee` entities | Entités TypeORM | `modules/merge-requests/entities/` |
| Créer `domain/resolve-ready-at.ts` | Fonction pure | Table de transition RG-004-04, exhaustive |
| Créer `MergeRequestsService.upsertForProject` / `.deleteMissing` | Service | `modules/merge-requests/merge-requests.service.ts` + spec |
| Créer `gitlab/types/gitlab-merge-request.ts` | Types | Forme brute du nœud GraphQL |
| Créer `gitlab/mappers/map-graphql-merge-request.ts` | Fonction pure | GID → id numérique, aplatissement des listes + spec |
| Étendre `GitlabClientService.getOpenMergeRequests` | Service | Requête GraphQL paginée, retry 429, deadline 60 s + spec |
| Créer `GitlabTimeoutException` | Exception | `common/exceptions/business.exception.ts` |
| Créer `domain/summarize-sync-run.ts` | Fonction pure | Agrégation succès/partial/error + message + spec |
| Créer `SyncRun` entity | Entité TypeORM | `modules/sync/entities/sync-run.entity.ts` |
| Créer `SyncService.trigger` / `.run` / `.getStatus` | Service | `modules/sync/sync.service.ts` + spec |
| Créer `SyncController` | Controller | `POST /sync`, `GET /sync/status` |
| Créer `UsersModule`, `MergeRequestsModule`, `SyncModule` | Modules | Imports/exports croisés (Gitlab, Settings, Projects) |
| Ajouter les 3 modules à `AppModule` | Config | — |
| Créer `test/sync.e2e-spec.ts` | Test e2e | Scénarios Gherkin de `specs.md` §6 (mock GitLab GraphQL) |

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|---------------------------|--------|--------------------|
| `common/exceptions/business.exception.ts` | Ajout `GitlabTimeoutException` | Faible | Classe supplémentaire, aucun changement des exceptions existantes |
| `common/exceptions/index.ts` | Export de la nouvelle exception | Faible | — |
| `app.module.ts` | Ajout de 3 imports de module | Faible | Ordre après `ProjectsModule`, aucune dépendance circulaire (Sync dépend de Settings/Projects/Gitlab/MergeRequests/Users, pas l'inverse) |
| `ProjectsService.remove()` | Le commentaire mentionnant l'absence de cascade devient obsolète | Faible | Retirer ce commentaire (devenu faux) au moment du dev, sans changer le comportement (la cascade est en base) |

---

## Frontend

### Intégration dans les features existantes

- `features/board/` reçoit son premier vrai contenu (jusqu'ici : placeholder). `BoardPageComponent` devient un
  composant "page" au sens de `architecture-frontend.md` : il injecte `SyncStore`, `SettingsStore`, `ProjectsStore`
  et compose `BoardToolbarComponent` + bandeau/état vide/placeholder existant.
- `features/settings/settings-page.component.ts` (`save()`) et
  `features/settings/sections/repositories/repositories-section.component.ts` (`addRepo()`) reçoivent chacun un
  appel "fire-and-forget" au nouveau `SyncStore` (RG-004-15) — aucune route ni navigation ajoutée dans cette
  feature.
- Aucune nouvelle route : `/` reste `BoardPageComponent`.

### Composants réutilisables et Angular Material

| Composant | Origine | Usage prévu |
|-----------|---------|-------------|
| `mat-toolbar`, `mat-icon-button`, `mat-stroked-button`/`mat-icon`, `matTooltip` | Angular Material | Existants dans `board-page.component.html`, conservés, complétés par le statut et le bouton Rafraîchir |
| `mat-progress-bar mode="indeterminate"` | Angular Material | Barre 2 px sous la toolbar pendant la synchro (RG-004-08), correspond au `md-linear-progress` de la maquette |
| `svgIcon="refresh-cw"` | `shared/icons` (déjà enregistrée) | Bouton Rafraîchir |
| `svgIcon="alert-circle"` | `shared/icons` (déjà enregistrée) | Bandeau "Aucun jeton configuré" |
| `mat-button`/`mat-stroked-button` + `routerLink` | Angular Material | Boutons "Configurer" et "Ajouter un repo" (→ `/settings`), sur le modèle du lien Paramètres déjà présent |
| `MatSnackBar` | Angular Material | Toast d'erreur de fin de synchro `partial`/`error` (RG-004-12), sur le modèle des toasts de `settings-page` |

Aucun nouveau composant Material n'est nécessaire ; le bandeau et l'état vide restent des blocs de template simples
dans `board-page.component.html` (pas de composant dédié : ils n'ont ni état interne ni réutilisation ailleurs — voir
`design.md`). Seul `BoardToolbarComponent` est un nouveau composant, car il porte un état local non trivial
(recalcul du libellé toutes les 30 s).

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Créer `models/sync-status.model.ts` | Interface TS | `SyncRun`, `SyncStatus` (miroir de `SyncRunDto`/`GET /sync/status`) |
| Créer `core/api/sync.service.ts` | Service Angular | `postSync(projectId?): Observable<{running:true}>`, `getStatus(): Observable<SyncStatus>` |
| Créer `stores/sync.store.ts` | SignalStore | État `{ running, lastRun, loading }` ; méthodes `loadStatus()`, `trigger(projectId?)`, `startPolling()`/`stopPolling()` — détail ci-dessous |
| Créer `features/board/sync-status-label.ts` | Fonction pure | `computeSyncStatusLabel({running, lastRun}, nowMs): { key: string; params?: {minutes:number} }` (RG-004-08) + spec exhaustive (jamais synchronisé, à l'instant, N min, échec) |
| Créer `features/board/board-toolbar/board-toolbar.component.ts` (+ html/scss/spec) | Composant | Brand, libellé de statut (tick 30 s interne), `mat-progress-bar`, bouton Rafraîchir ; `input()` `running`/`lastRun`, `output()` `refresh` |
| Étendre `board-page.component.ts` (+ html) | Composant page | Injecte `SyncStore`/`SettingsStore`/`ProjectsStore`, calcule bandeau/état vide/toolbar, démarre/arrête le polling |
| Étendre `settings-page.component.ts` (`save()`) | Composant | Appel fire-and-forget `syncStore.trigger()` après succès de `PUT /settings` |
| Étendre `repositories-section.component.ts` (`addRepo()`) | Composant | Appel fire-and-forget `syncStore.trigger(project.id)` après ajout réussi |
| Ajouter clés `board.sync.*`, `board.noToken.*`, `board.noRepos.*` | i18n | `public/i18n/fr.json` |

#### `SyncStore` — détail

- État : `{ running: boolean; lastRun: SyncRun | null; loading: boolean }`.
- `loadStatus(): Promise<void>` — `GET /sync/status`, `patchState`.
- `trigger(projectId?: number): Promise<void>` — `POST /sync`, puis appelle `loadStatus()` immédiatement (que la
  requête réussisse ou échoue au niveau transport ; le contrat backend ne renvoie pas d'erreur métier). Un seul
  point d'entrée pour les **trois** usages : bouton Rafraîchir (`BoardToolbarComponent` → `output refresh` →
  `board-page` → `syncStore.trigger()`), et les deux déclenchements automatiques RG-004-15
  (`settings-page.save()` → `void this.syncStore.trigger()` ; `repositories-section.addRepo()` →
  `void this.syncStore.trigger(added.id)`). L'appel immédiat à `loadStatus()` après le `POST` est ce qui permet au
  bouton Rafraîchir de se désactiver "dès la requête envoyée" (RG-004-09) sans attendre le prochain tick du
  polling.
- `startPolling()` / `stopPolling()` — boucle auto-ajustée par `setTimeout` récursif (pas `setInterval`, car le
  délai change selon `running()`) : après chaque `loadStatus()`, replanifie dans 5 s si `running()` est vrai, 60 s
  sinon (RG-004-08). `BoardPageComponent` appelle `startPolling()` dans son constructeur et `stopPolling()` via
  `DestroyRef.onDestroy(...)` — le polling s'arrête bien en quittant l'écran Tableau.
- **Résolution du projet nouvellement ajouté (`repositories-section.addRepo()`)** : `ProjectsStore.add()` garde son
  contrat existant (`Promise<string | null>`, clé d'erreur ou succès) pour ne pas casser sa cohérence avec
  `rename()`/`remove()`/`SettingsStore.save()`. Le repo nouvellement créé est déterministement le dernier élément de
  `store.projects()` juste après un `add()` réussi (`patchState(store, { projects: [...store.projects(), project] })`
  dans `projects.store.ts`) : `repositories-section.component.ts` lit
  `this.store.projects().at(-1)` immédiatement après un `add()` retournant `null`, pour en extraire l'`id` à passer
  à `syncStore.trigger(id)`.

#### `board-page.component` — bandeau / état vide / toolbar

- Injecte `SettingsStore`, `ProjectsStore`, `SyncStore` ; appelle `settingsStore.load()` et `projectsStore.load()`
  dans `ngOnInit` (idempotent si déjà chargés ailleurs, comme dans `settings-page`).
- `noToken = computed(() => settings() !== null && !settings()!.tokenConfigured)` (attend le chargement pour éviter
  un flash, RG-004-10).
- `noRepos = computed(() => !noToken() && projects().length === 0 && !projectsStore.loading())` (RG-004-11,
  mutuellement exclusif avec `noToken` comme prescrit par la spec).
- Le bouton Rafraîchir de `BoardToolbarComponent` reçoit `disabled = noToken() || syncStore.running()`.
- La zone tableau garde son `<p class="placeholder">` actuel, affiché seulement si ni `noToken()` ni `noRepos()`
  (US-005 le remplacera).

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|---------------------------|--------|--------------------|
| `board-page.component.ts`/`.html` | Ajout d'état (stores, computed) et de blocs conditionnels | Faible | Composant déjà minimal, pas de régression possible sur l'existant (le placeholder reste le comportement par défaut) |
| `settings-page.component.ts` (`save()`) | Ajout d'un appel fire-and-forget après le succès de `store.save(...)` | Faible | Ne modifie ni le flux existant ni son retour ; erreurs de sync ignorées par construction (best-effort) |
| `repositories-section.component.ts` (`addRepo()`) | Ajout d'un appel fire-and-forget après `store.add(...)` réussi | Faible | Idem ; lecture de `store.projects().at(-1)` documentée en commentaire pour ne pas surprendre un futur lecteur |
| `public/i18n/fr.json` | Ajout de clés `board.*` | Nul | Additif |

---

## Points de vigilance globaux

- **Charge GitLab** : la synchronisation séquentielle (pas parallèle, RG-004-05) et le timeout de 60 s par projet
  bornent la durée totale à `nb_projets × 60 s` dans le pire cas ; acceptable pour l'usage visé (équipe restreinte,
  peu de repos) mais à surveiller si le nombre de repos configurés croît significativement — hors périmètre de
  cette US (pas de parallélisation prévue avant une éventuelle évolution future).
- **Jeton** : jamais loggé, y compris dans les messages d'erreur agrégés de `sync_runs.error_message` (réutilise les
  messages déjà "safe" des exceptions GitLab existantes).
- **Idempotence du calcul `ready_at`** : `resolve-ready-at.ts` est le point critique unique de toute la feature
  (RG-004-04) — sa couverture de tests doit inclure explicitement les 6 lignes de la table, pas seulement les cas
  "heureux". Toute évolution future de cette fonction doit être traitée avec la même rigueur qu'une migration de
  données (US-007 en dépend entièrement).
- **Cascade `ON DELETE CASCADE`** : la suppression d'un `Project` (US-003, déjà en place) supprime désormais aussi
  ses `merge_requests` et leurs lignes reviewers/assignees. Comportement voulu (aucune donnée orpheline) mais à
  vérifier explicitement dans le test e2e de suppression de repo (pas de régression silencieuse).
- **Polling frontend** : `SyncStore.startPolling()`/`stopPolling()` n'est appelé que par `BoardPageComponent` — si
  une future US ajoute un second point d'entrée affichant le statut de synchro (ex. un badge dans la toolbar de
  `/settings`), il faudra un compteur de références plutôt qu'un simple `stopPolling()` inconditionnel à la
  destruction, pour ne pas couper le polling d'un autre écran encore affiché. Non nécessaire aujourd'hui (un seul
  consommateur).
- **`GET /sync/status` pendant l'ajout d'un repo** : le fire-and-forget de `repositories-section.addRepo()` ne fait
  pas apparaître de retour visuel sur l'écran Paramètres (pas de barre de progression there) — c'est voulu, la
  toolbar synchro n'existe que sur l'écran Tableau (RG-004-15 : asynchrone, ne bloque ni le toast ni la navigation).

---

## Ordre de réalisation suggéré

1. Migration TypeORM (`users`, `merge_requests`, `merge_request_reviewers`, `merge_request_assignees`, `sync_runs`) + entités
2. `domain/resolve-ready-at.ts` et `domain/summarize-sync-run.ts` (fonctions pures) + tests unitaires exhaustifs
3. `gitlab/mappers/map-graphql-merge-request.ts` (fonction pure) + tests
4. `GitlabClientService.getOpenMergeRequests` (GraphQL, pagination, retry 429, deadline) + `GitlabTimeoutException` + tests
5. `UsersService`, `MergeRequestsService` (upsert/delete) + tests unitaires
6. `SyncService` (verrou, orchestration séquentielle, statut) + tests unitaires
7. `SyncController` + DTOs + `SyncModule`/`UsersModule`/`MergeRequestsModule` dans `AppModule` + `test/sync.e2e-spec.ts`
8. `models/sync-status.model.ts`, `core/api/sync.service.ts`, `stores/sync.store.ts` + tests
9. `features/board/sync-status-label.ts` (fonction pure) + tests
10. `board-toolbar/` (composant) + i18n + tests
11. `board-page.component` (bandeau, état vide, wiring toolbar/polling) + tests
12. Wiring fire-and-forget dans `settings-page.save()` et `repositories-section.addRepo()` + tests de régression
