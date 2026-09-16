# Architecture — US-031 Identité « Moi » résolue depuis le jeton

## Résumé fonctionnel
La section `01 · Moi` disparaît des Paramètres. Chaque connexion résout désormais automatiquement son identité
(username, nom, email, avatar) depuis son jeton, affichée en lecture seule dans « Connexions » (« Connecté en tant
que »). La case « Surligner mes MRs » migre dans « Divers ». « Mes MRs » et l'anneau de surbrillance comparent
toujours l'identité par connexion, désormais résolue plutôt que saisie.

---

## Backend

### Impacts sur le modèle de données

**`connections` (`Connection` entity, `backend/src/modules/connections/entities/connection.entity.ts`)**
- Colonne supprimée : `me_username` (saisie manuelle, RG-019-01).
- Colonnes ajoutées (toutes nullable, résolues) :
  - `resolved_username` (text) — remplace `meUsername` comme source de RG-G09/isMine.
  - `resolved_name` (text) — nom complet, pour l'affichage « Connecté en tant que ».
  - `resolved_email` (text) — email exposé par la forge pour ce compte, `null` sinon (GitHub notamment).
  - `resolved_avatar_url` (text) — pour réutiliser `AvatarComponent`.
- Toutes les 4 colonnes évoluent ensemble, mises à jour uniquement par `ConnectionsService.resolveIdentity()`
  (nouvelle méthode, voir plus bas) : jamais par `add`/`update` directement au-delà du déclenchement fire-and-forget.

**`settings` (`Settings` entity, `backend/src/modules/settings/entities/settings.entity.ts`)**
- Colonne supprimée : `me_email` (repli global RG-002-01, devenu sans objet — RG-031-01).
- `highlight_me` : **aucun changement de schéma**, seule sa section d'affichage change côté frontend.

### Migrations

- **`AddResolvedIdentityToConnections`** (nouvelle, ex. `1757602000000-AddResolvedIdentityToConnections.ts`) :
  1. Ajoute `resolved_username`, `resolved_name`, `resolved_email`, `resolved_avatar_url` (text, nullable) à
     `connections`.
  2. Seed : `UPDATE connections SET resolved_username = me_username` (les 3 autres colonnes restent `NULL` — RG-031-13,
     seul le username est reporté, faute de nom/email/avatar connus avant la première résolution post-migration).
  3. Supprime la colonne `me_username` de `connections`.
  4. Supprime la colonne `me_email` de `settings`.
- SQLite via `better-sqlite3`/TypeORM : ajout de colonne = `ALTER TABLE ADD COLUMN` direct ; suppression de colonne
  nécessite la recréation de table (`CREATE TABLE ... ; INSERT INTO ... SELECT ... ; DROP ; RENAME`), comme les
  migrations précédentes de ce projet qui suppriment déjà des colonnes (voir `1757601400000-MigrateSettingsToConnections.ts`
  pour le pattern à reproduire).
- `down()` : recrée `me_username`/`me_email`, réinjecte `resolved_username` dans `me_username`, supprime les 4
  colonnes résolues.

### Intégration dans les modules existants

- **`modules/forges`** : `ForgeTestResult` (`types/forge-test-result.ts`) gagne un champ `email: string | null`.
  `ForgeClient.testConnection` reste la seule méthode de résolution d'identité — aucune nouvelle méthode de contrat,
  aucun changement de signature.
- **`modules/gitlab`** (`GitlabClientService.testConnection`) : `GitlabUser` (`types/gitlab-user.ts`) gagne
  `email: string | null` (déjà exposé par `GET /api/v4/user` pour le titulaire du jeton) ; mappé vers
  `ForgeTestResult.email`.
- **`modules/github`** (`GithubClientService.testConnection`) : `GithubUser` (`types/github-user.ts`) gagne
  `email: string | null` (`GET /user`, `null` si non public / scope `user:email` absent) ; mappé tel quel — pas de
  requête supplémentaire à `/user/emails` (hors périmètre, RG-031-02 accepte `null`).
- **`modules/connections`** (`ConnectionsService`) :
  - Nouvelle méthode `async resolveIdentity(connection: Connection): Promise<void>` : lit le jeton
    (`getToken`/`cipher.decrypt`), appelle `forge.testConnection(connection.url, token)`, et sur succès met à jour
    `resolvedUsername/resolvedName/resolvedEmail/resolvedAvatarUrl` + `updatedAt`, puis sauvegarde. Sur échec
    (n'importe quelle exception forge), **ne fait rien** (conserve les valeurs précédentes) — jamais levée à
    l'appelant (best-effort, catch interne).
  - `add()` : après la sauvegarde de la connexion, si un jeton est fourni, démarre
    `void this.resolveIdentity(saved).catch(() => {})` **sans l'attendre** (la réponse HTTP 201 part immédiatement,
    `identity` y est donc toujours `null` — RG-031-15). Remplace l'initialisation `meUsername: null`.
  - `update()` : même déclenchement fire-and-forget **uniquement quand `dto.token` est fourni** (un changement de
    nom/URL seul ne justifie pas une nouvelle résolution).
  - `test()` (inchangée dans sa logique de résolution des paramètres) : sur un résultat réussi **et** `connectionId`
    fourni, persiste directement le résultat sur la connexion testée (mêmes 4 champs) avant de retourner le
    `ForgeTestResult` au contrôleur — pas de round-trip supplémentaire au forge (RG-031-04).
  - `updateIdentity(connectionId, username)` : **supprimée** (n'a plus d'appelant, remplacée par `resolveIdentity`).
  - `importUpsert(entry)` : perd le paramètre `meUsername` — une connexion importée n'a jamais d'identité résolue
    tant qu'un jeton n'est pas configuré et qu'une résolution n'a pas eu lieu (RG-031-14).
  - `toResponse()` : remplace le champ `meUsername` par `identity: ConnectionIdentityDto | null` (voir DTO plus bas).
- **`modules/sync`** (`SyncService.syncTargets`) : dans la branche « full sync » (pas de `projectId`), pour **chaque**
  connexion retournée par `connections.findAll()` — y compris celles sans repo actif — appelle
  `void this.connections.resolveIdentity(connection)` en tâche de fond, en parallèle du traitement de ses repos (ne
  bloque pas `syncConnectionProjects`, n'apparaît pas dans `ProjectSyncOutcome`/le résumé du run : un échec de
  résolution n'est jamais reflété dans `sync_runs.error_message`, RG-031-03). La branche mono-projet (`projectId`
  fourni, resynchronisation d'un seul repo) ne déclenche **pas** de résolution d'identité (hors périmètre, resync
  ciblée sur un repo, pas sur une connexion).
- **`modules/settings`** (`SettingsService`) :
  - `MergeableSettingsFields`/`ExportableSettings` : suppression de `meEmail`.
  - `update()` : suppression du bloc `if (dto.identities) {... this.connections.updateIdentity(...) }` et de sa
    dépendance à `ConnectionsService` pour cet usage (la dépendance au constructeur reste si d'autres méthodes
    l'utilisent encore — à vérifier en dev, sinon la retirer).
  - `getMeEmail()` : **supprimée** (plus aucun appelant après la modification de `merge-requests.service.ts`).
  - `load()` (valeurs par défaut) : retire `meEmail: null`.
  - `toResponse()`/`getExportableSettings()` : retirent `meEmail`.
- **`modules/settings-transfer`** :
  - `SettingsTransferService.export()` : `connections.map(...)` retire `meUsername` du tableau exporté.
  - `importLegacy()` : retire `meUsername: settingsDto.meUsername?.trim() || null` de l'appel à `importUpsert`.
  - `importCurrent()` : idem pour chaque connexion importée.
  - DTOs : `ExportConnectionDto` retire `meUsername` ; `ImportConnectionDto` retire son champ `meUsername?` ;
    `ImportSettingsLegacyDto` retire son champ `meUsername?` (le `ValidationPipe` global `whitelist: true` absorbe
    silencieusement un champ `meUsername` présent dans un fichier plus ancien — RG-031-14, aucun code de
    compatibilité à écrire) ; `ImportSettingsDto`/`UpdateSettingsDto` retirent `meEmail` ; `UpdateSettingsDto` retire
    `identities` (et `identity.dto.ts` devient orphelin → à supprimer).
- **`modules/merge-requests`** (`MergeRequestsService.loadBase`) :
  - Retire l'appel `this.settings.getMeEmail()` du `Promise.all` (RG-031-08).
  - `identityMissing` devient `allConnections.every((c) => c.resolvedUsername === null)` (plus de repli sur
    `meEmail`).
  - `resolveIdentity()` (fonction module-privée, homonyme de la nouvelle méthode de service — **à renommer** pour
    éviter la confusion, ex. `identityFor(connectionId, connectionsById)`) : lit
    `connectionsById.get(connectionId)?.resolvedUsername ?? null` et
    `connectionsById.get(connectionId)?.resolvedEmail ?? null` au lieu de `meUsername`/le paramètre `meEmail` global.
  - `toMergeRequestView()`/`toMergeRequestUser()` : suppriment le paramètre `meEmail`, propagent seulement
    `connectionsById`.
  - `domain/is-mine.ts` (`isMe`, `isMine`) : **aucun changement** — la fonction reste alimentée par un `Identity`
    dont la provenance change seule (RG-031-08).

### Contrat API

| Méthode | Route                | Body / Query                                        | Réponse (changements)                                                              | Codes |
|---------|-----------------------|------------------------------------------------------|--------------------------------------------------------------------------------------|-------|
| GET     | `/api/v1/connections`  | —                                                     | `ConnectionResponseDto[]` : `meUsername` → `identity: ConnectionIdentityDto \| null` | 200   |
| POST    | `/api/v1/connections`  | inchangé                                              | `identity` toujours `null` (résolution async, RG-031-03)                             | 201   |
| PUT     | `/api/v1/connections/:id` | inchangé                                          | `identity` inchangée si le jeton n'a pas changé, sinon dernière valeur connue        | 200   |
| POST    | `/api/v1/connections/test` | inchangé                                         | `TestConnectionResult` gagne `email: string \| null` ; effet de bord : persiste l'identité sur `connectionId` (RG-031-04) | 200   |
| GET/PUT | `/api/v1/settings`     | `PUT` : suppression de `meEmail` et `identities`      | Suppression de `meEmail`                                                             | 200   |
| GET     | `/api/v1/settings/export` | —                                                  | `connections[].meUsername` supprimé                                                  | 200   |

`ConnectionIdentityDto` (nouveau, `connections/dto/connection-identity.dto.ts`) :
```
{ username: string; name: string; email: string | null; avatarUrl: string | null }
```

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Créer migration `AddResolvedIdentityToConnections` | Migration | Ajoute les 4 colonnes résolues, seed, supprime `me_username`/`me_email` |
| Étendre `Connection` entity | Entité TypeORM | `resolvedUsername/resolvedName/resolvedEmail/resolvedAvatarUrl`, retrait de `meUsername` |
| Réduire `Settings` entity | Entité TypeORM | Retrait de `meEmail` |
| Créer `ConnectionIdentityDto` | DTO | Forme de `identity` dans `ConnectionResponseDto` |
| Étendre `ForgeTestResult` | Type | Ajoute `email: string \| null` |
| Étendre `GitlabUser`/`GithubUser` | Type | Ajoute `email: string \| null`, mappé dans chaque `testConnection` |
| Créer `ConnectionsService.resolveIdentity` | Méthode | Résolution best-effort, appelée par `add`/`update`/`SyncService` |
| Modifier `ConnectionsService.add/update/test/toResponse/importUpsert` | Service | Voir détail ci-dessus |
| Supprimer `ConnectionsService.updateIdentity` | Service | Orpheline |
| Modifier `SyncService.syncTargets` | Service | Résolution d'identité par connexion en tâche de fond à chaque sync complet |
| Modifier `SettingsService` | Service | Retrait de `meEmail`/`getMeEmail`/gestion `identities` |
| Modifier `SettingsTransferService` + DTOs | Service/DTO | Retrait de `meUsername`/`meEmail` de l'export ; import silencieux (whitelist) |
| Supprimer `identity.dto.ts` | DTO | Orpheline (`identities` retiré de `UpdateSettingsDto`) |
| Modifier `MergeRequestsService.loadBase`/`resolveIdentity`(renommer)/`toMergeRequestView` | Service | Source d'identité = connexion résolue |
| Mettre à jour tous les tests unitaires/e2e touchant `meUsername`/`meEmail`/`identities` | Tests | Voir liste des fichiers impactés (§ Modifications sur l'existant) |

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|------------------|---------------------------|--------|--------------------|
| `connections.entity.ts` | Colonne renommée/éclatée (`meUsername` → 4 colonnes résolues) | Moyen | Migration avec seed (RG-031-13), pas de perte fonctionnelle immédiate |
| `settings.entity.ts` | Suppression de `meEmail` | Faible | Migration ; plus aucun code ne le lit après le refactor de `merge-requests.service.ts` |
| `merge-requests.service.ts` | Suppression du paramètre `meEmail`, renommage de la fonction privée `resolveIdentity` (collision de nom avec la nouvelle méthode du service) | Moyen | Renommer en `identityFor` avant d'ajouter la méthode de `ConnectionsService`, pour éviter toute confusion de lecture (pas de collision de compilation, juste de clarté) |
| `settings.service.ts` | Suppression de `getMeEmail`, du bloc `identities` dans `update()` | Faible | Vérifier qu'aucun autre appelant de `getMeEmail` ne subsiste (`Grep` avant suppression) |
| `settings-transfer.service.ts` + DTOs | Suppression de champs export/import | Faible | Les anciens fichiers exportés restent important-ables (`whitelist: true` absorbe les champs en trop) |
| `connections.service.ts` | Ajout de `resolveIdentity`, appels fire-and-forget dans `add`/`update` | Moyen | Catch interne systématique ; ne jamais laisser une exception de résolution remonter à l'appelant HTTP |
| `sync.service.ts` | Ajout d'un appel de résolution par connexion dans la boucle de sync complète | Faible | Fire-and-forget, aucun impact sur `ProjectSyncOutcome`/`summarizeSyncRun` |
| Tests unitaires/e2e listés par `grep meUsername`/`meEmail`/`identities` (≈15 fichiers backend, ≈15 fichiers frontend) | Mise à jour des fixtures et assertions | Moyen (volume) | Traiter module par module en phase Dev ; voir liste indicative ci-dessous |

Fichiers de test à revisiter (non exhaustif, trouvés par recherche textuelle) : `connections.service.spec.ts`,
`connections.controller.spec.ts`, `merge-requests.service.spec.ts`, `settings.service.spec.ts`,
`settings.controller.spec.ts`, `settings-transfer.service.spec.ts`, `test/connections.e2e-spec.ts`,
`test/settings.e2e-spec.ts`, `test/settings-transfer.e2e-spec.ts`.

---

## Frontend

### Intégration dans les features existantes

- Feature `features/settings` : suppression complète de `sections/me/` (composant, spec, html/scss) et de
  `me-identity.ts`/`.spec.ts`.
- `sections/connections/connections-section.component.*` : reçoit l'affichage « Connecté en tant que » (nouveau
  bloc dans le template, pas de nouveau composant — réutilise `AvatarComponent`).
- `sections/miscellaneous/miscellaneous-section.component.html` : reçoit la case `highlightMe` (déjà dans
  `SettingsFormControls`, juste déplacée de template).
- `settings-page.component.html` : suppression du bloc `app-settings-section` « Moi », renumérotation des clés
  `number` (`settings.connections.number` etc. passent de `"02".."06"` à `"01".."05"`).
- Aucune nouvelle route.

### Composants réutilisables et Angular Material

| Composant | Origine | Usage prévu |
|-----------|---------|-------------|
| `AvatarComponent` | `shared/avatar` | Avatar 28 px (ou 20 px, à trancher en `design.md`) dans « Connecté en tant que » |
| `mat-checkbox` | Angular Material | Case `highlightMe`, déplacée telle quelle dans « Divers » |

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Étendre `Connection` (`models/connection.model.ts`) | Interface TS | `meUsername` → `identity: ConnectionIdentity \| null` |
| Créer `ConnectionIdentity` | Interface TS | `{ username, name, email, avatarUrl }` (même forme que le DTO backend) |
| Étendre `TestConnectionResult` (`models/connection.model.ts`) | Interface TS | Ajoute `email: string \| null` |
| Modifier bloc « Connecté en tant que » dans `connections-section.component.html/.ts/.scss` | Composant | Affichage résolu / non résolu / masqué (RG-031-06) |
| Modifier `ConnectionsStore.testConnection` | SignalStore | Sur succès avec `connectionId`, patch aussi `identity` de la connexion correspondante dans `connections` (miroir de la persistance backend, RG-031-04) |
| Ajouter case `highlightMe` dans `miscellaneous-section.component.html` | Composant | `formControlName="highlightMe"`, en tête de section |
| Supprimer `sections/me/*`, `me-identity.ts(.spec)` | Suppression | Section retirée (RG-031-01) |
| Supprimer `identities` de `SettingsFormControls`/`settings-form.ts` | Formulaire | Retrait de `identities: FormArray<IdentityForm>`, de `syncIdentitiesFormArray` (`connections-form.ts`), de son usage dans `toUpdateRequest`/`settings-page.component.ts` |
| Supprimer `meEmail` de `SettingsFormControls`/`settings-form.ts`/`Settings`/`UpdateSettingsRequest` (`models/settings.model.ts`) | Formulaire/Modèle | Retrait complet (build/reset/toDefaults/toUpdateRequest) |
| Mettre à jour `board-page.component.ts` (`identityConfigured`) | Composant | `settings?.meEmail \|\| connections.some(c => !!c.meUsername)` → `connections().some((c) => !!c.identity)` |
| Ajouter clés `settings.connections.identity.*` | i18n | `resolved` (gabarit avec `{{name}}`, `{{username}}`, `{{email}}`), `unresolved`, omission si pas de jeton |
| Retirer clés `settings.me.*` | i18n | `fr.json`/`en.json`, les deux en même temps (parité) |
| Mettre à jour `settings.*.number` | i18n | `connections: "01"`, `refresh: "02"`, `difficulty: "03"`, `readyDelay: "04"`, `misc: "05"` |
| Mettre à jour `board.filters.mineDisabledTooltip` | i18n | « Ajoutez une connexion avec un jeton valide » (RG-031-12) au lieu de « Configurez votre identité dans les paramètres » |

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|------------------|---------------------------|--------|--------------------|
| `settings-page.component.html/.ts` | Suppression de la section Moi, de `identityRows`/`IDLE_TEST`/imports `me-identity`/`connections-form.syncIdentitiesFormArray`, renumérotation | Moyen | Suivre §4.2 renumérotée du README ; supprimer un bloc entier plutôt que le commenter |
| `settings-form.ts` | Retrait de `meEmail`/`identities` des `SettingsFormControls`, de `buildSettingsForm`, `resetSettingsForm`, `resetSettingsFormToDefaults`, `toUpdateRequest` | Moyen | Un seul fichier concentre le risque de régression ; couvrir par `settings-form.spec.ts` mis à jour |
| `connections-form.ts` | Suppression de `IdentityForm`/`syncIdentitiesFormArray` (devient orphelin si rien d'autre ne l'utilise) | Faible | Vérifier absence d'autre appelant avant suppression du fichier entier |
| `models/connection.model.ts` | `meUsername` → `identity` ; `TestConnectionResult` +`email` | Faible | Type miroir strict du DTO backend |
| `models/settings.model.ts` | Retrait de `meEmail` (`Settings`, `UpdateSettingsRequest`) | Faible | — |
| `board-page.component.ts` | `identityConfigured` recalculé sans `meEmail` | Faible | Voir tâche ci-dessus |
| `connections-section.component.scss` | Nouveau bloc visuel | Faible | Réutiliser les tokens existants (pas de nouvelle couleur) |
| Specs Angular touchant `meUsername`/`identities`/`meEmail` (≈15 fichiers, voir recherche) : `settings-page.component.spec.ts`, `settings-form.spec.ts`, `connections-form.spec.ts`, `connections.store.spec.ts`, `connections-section.component.spec.ts`, `repositories-section.component.spec.ts`, `miscellaneous-section.component.spec.ts`, `board-page.component.spec.ts`, `merge-requests.store.spec.ts`, `config-transfer.spec.ts` | Mise à jour fixtures/assertions | Moyen (volume) | Traiter avec les composants correspondants en phase Dev |
| Dictionnaires `fr.json`/`en.json` | Retrait `settings.me.*`, ajout `settings.connections.identity.*`, renumérotation `*.number`, `mineDisabledTooltip` | Faible | `dictionary-parity.spec.ts` garde-fou existant |

---

## Points de vigilance globaux

- **Fenêtre « non résolu »** : entre la création d'une connexion (201 immédiat, `identity: null`) et la fin de la
  résolution fire-and-forget (généralement < 1 s, un seul appel HTTP au forge), l'utilisateur peut voir brièvement
  « Identité non résolue ». Accepté (QO-031-02 tranché en ce sens) ; à valider visuellement en QA plutôt qu'à
  masquer par un polling frontend (hors périmètre).
- **RG-019-12 non totalement implémentée telle que documentée** : la spec US-019 affirme qu'une création/modification
  de connexion « déclenche une synchronisation des repos » — en réalité, ni le frontend (`connections-section.component.ts`)
  ni `ConnectionsService` ne déclenchent `SyncService.trigger()` aujourd'hui. Cette US **n'ajoute pas** ce
  déclenchement manquant (hors périmètre) ; elle s'appuie uniquement sur son propre mécanisme fire-and-forget
  dédié à l'identité (indépendant de la synchronisation des repos). ⚠️ **Point à clarifier avec le PO/l'utilisateur**
  si ce gap doit être comblé dans une US séparée.
- **Coût réseau** : la résolution d'identité à chaque sync complet ajoute un appel `/user` (GitLab) ou `/user`
  (GitHub) par connexion et par cycle de synchronisation (jusqu'à une fois par minute si `refreshIntervalMin = 1`).
  Négligeable en volume (pas de pagination, endpoint léger), mais consomme un point de rate-limit GitHub par cycle —
  acceptable au regard du volume actuel (RG-020-11 gère déjà le rate-limiting ailleurs).
- **Sécurité** : `resolvedEmail` est une donnée personnelle du titulaire du jeton (moi) — déjà le cas de
  `meEmail` aujourd'hui, aucun changement de surface d'exposition (jamais renvoyé à un tiers, l'API n'a qu'un
  client).
- **Cohérence `isMine`** : à surveiller en QA — une MR jugée « à moi » avant migration (via `meUsername` saisi,
  potentiellement erroné) peut changer de statut après la première résolution post-migration si l'ancienne saisie
  différait du jeton réel (comportement voulu, RG-031-10, mais à vérifier dans un scénario e2e dédié).

---

## Ordre de réalisation suggéré
1. Migration TypeORM (`AddResolvedIdentityToConnections`) + mise à jour des entités `Connection`/`Settings`
2. `ForgeTestResult`/`GitlabUser`/`GithubUser` + mapping `email` dans les deux clients forge, tests unitaires
3. `ConnectionsService.resolveIdentity` + branchement dans `add`/`update`/`test` + `ConnectionIdentityDto`, tests unitaires
4. `SyncService.syncTargets` : résolution par connexion en tâche de fond, tests unitaires
5. `MergeRequestsService` : retrait de `meEmail`, renommage `resolveIdentity` → `identityFor`, source = connexion résolue, tests unitaires
6. `SettingsService`/`SettingsTransferService` + DTOs : retrait `meEmail`/`identities`/`meUsername` export-import, tests unitaires + e2e
7. Contrôleurs + DTOs de réponse (`ConnectionResponseDto`), tests e2e (`connections`, `settings`, `settings-transfer`)
8. Frontend : modèles TS (`connection.model.ts`, `settings.model.ts`), `ConnectionsStore`
9. Frontend : suppression de la section Moi (`sections/me/*`, `me-identity.ts`, `connections-form.ts` si orpheline), `settings-form.ts`, `settings-page.component.*`
10. Frontend : bloc « Connecté en tant que » dans `connections-section.component.*`, case `highlightMe` dans `miscellaneous-section.component.*`
11. i18n (`fr.json`/`en.json`) : retrait `settings.me.*`, ajout `settings.connections.identity.*`, renumérotation, `mineDisabledTooltip`
12. `board-page.component.ts` (`identityConfigured`) + tests
13. Tests unitaires frontend restants et validation manuelle contre le rendu proposé (`design.md`)

---

## ⚠️ Points à clarifier

1. **RG-019-12 non implémentée** (voir « Points de vigilance ») : la création/modification d'une connexion ne
   déclenche aujourd'hui aucune synchronisation de ses repos, contrairement à ce que documente US-019. Cette US
   contourne le problème avec son propre mécanisme fire-and-forget dédié à l'identité, mais le gap plus large reste
   entier — à signaler au PO pour décider s'il justifie une US corrective séparée.
2. **Position exacte de l'avatar/bloc « Connecté en tant que »** dans la ligne de connexion (résumé toujours visible
   vs. affiché seulement une fois la carte dépliée) : la spec (RG-031-06) demande « chaque ligne », donc visible
   sans dépliage — à confirmer visuellement, aucune maquette n'existe (voir `design.md`).
3. **Renommage de la fonction privée `resolveIdentity`** dans `merge-requests.service.ts` (collision de nom avec la
   nouvelle méthode publique `ConnectionsService.resolveIdentity`) : proposé `identityFor`, à valider en Dev — pur
   renommage, aucun impact fonctionnel.
