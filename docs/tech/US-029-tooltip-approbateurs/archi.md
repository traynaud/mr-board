# Architecture — US-029 Infobulle des approbateurs sur la colonne Approved

## Résumé fonctionnel
Quand une MR est approuvée, survoler la coche ✓ de la colonne Approved affiche une infobulle listant les noms des
utilisateurs ayant approuvé — exactement ceux qui font que `approved = true` (RG-G07/RG-029-01), sur le même
modèle de tooltip que les colonnes Reviewer/Affecté.

---

## Backend

### Impacts sur le modèle de données

- **Nouvelle entité** `MergeRequestApprover` (`backend/src/modules/merge-requests/entities/merge-request-approver.entity.ts`),
  copie exacte du couple `MergeRequestReviewer`/`MergeRequestAssignee` **après** leur correctif du 2026-09-15
  (`AddReviewerAssigneePosition`) :
  - `merge_request_id` (integer, FK `merge_requests.id` ON DELETE CASCADE) — clé primaire composite avec `user_id`
  - `user_id` (integer, FK `users.id`) — clé primaire composite
  - `position` (integer, défaut 0) — ordre forge/insertion, restitué explicitement au tri (même raison que
    RG-029-05 : SQLite trierait sinon par `user_id` croissant, perdant l'ordre)
  - Contrainte `PRIMARY KEY (merge_request_id, user_id)`, `FK_mr_approvers_merge_request`, `FK_mr_approvers_user`
    (mêmes noms de convention que `FK_mr_reviewers_*`/`FK_mr_assignees_*`)
- **Migration** `AddMergeRequestApprovers` (`backend/src/database/migrations/1757601900000-AddMergeRequestApprovers.ts`) :
  `CREATE TABLE "merge_request_approvers"` avec `position` dès la création (contrairement à `merge_request_reviewers`/
  `merge_request_assignees`, pas besoin d'un `ALTER TABLE` séparé puisque la table est neuve). `down` : `DROP TABLE`.
- Aucune modification de `merge_requests` (le booléen `approved` existant est conservé tel quel, RG-029 n'ajoute
  qu'une table d'association, pas de colonne).

### Intégration dans les modules existants

- Tout se passe dans `modules/merge-requests/` (entité, service) et `modules/gitlab/` + `modules/github/` (mappers,
  types, requêtes GraphQL) — aucun nouveau module NestJS.
- `MergeRequestsModule` (`merge-requests.module.ts`) : ajouter `MergeRequestApprover` au tableau
  `TypeOrmModule.forFeature([...])`, à côté de `MergeRequestReviewer`/`MergeRequestAssignee`.

### Contrat API

Endpoint existant étendu, pas de nouvelle route :

| Méthode | Route | Body / Query | Réponse | Codes |
|---------|-------|--------------|---------|-------|
| GET | `/api/v1/merge-requests` | inchangé | `MergeRequestsResponseDto` — chaque `MergeRequestViewDto` gagne `approvedBy: MergeRequestUserDto[]` | 200 |

`MergeRequestUserDto` (`username`, `name`, `avatarUrl`, `isMe`) est réutilisé tel quel — aucun nouveau DTO
utilisateur, `approvedBy` a exactement la même forme que `reviewers`/`assignees`.

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Créer `merge-request-approver.entity.ts` | Entité TypeORM | Copie de `MergeRequestReviewer` avec `position` dès la création |
| Créer migration `1757601900000-AddMergeRequestApprovers` | Migration | `CREATE TABLE merge_request_approvers` (voir ci-dessus) |
| Étendre `ForgeMergeRequest` (`forges/types/forge-merge-request.ts`) | Type | Ajouter `approvedBy: ForgeUser[]` |
| Étendre `GitlabGraphqlMergeRequestNode` (`gitlab/types/gitlab-merge-request.ts`) | Type | `approvedBy: { nodes: GitlabGraphqlUserNode[] }` au lieu de `{ nodes: { id: string }[] }` (réutilise le type déjà utilisé pour `reviewers`/`assignees`) |
| Étendre `MERGE_REQUESTS_QUERY` (`gitlab-client.service.ts`) | Requête GraphQL | `approvedBy { nodes { id username name avatarUrl webUrl } }` (mêmes champs que `reviewers`/`assignees`) |
| Modifier `mapGraphqlMergeRequest` (`gitlab/mappers/map-graphql-merge-request.ts`) | Mapper | Calculer une seule liste `approvers = node.approvedBy.nodes.filter(u => id(u) !== id(author)).map(mapGraphqlUser)` et dériver `approved: approvers.length > 0` et `approvedBy: approvers` de **cette même liste**, pour garantir RG-029-01 par construction (plus de risque de divergence entre le booléen et la liste) |
| Modifier `mapGraphqlPullRequest` (`github/mappers/map-graphql-pull-request.ts`) | Mapper | Calculer `approvedAuthors = reviewNodes.filter(r => r.state === 'APPROVED' && r.author !== null).map(r => mapGraphqlActor(r.author))` (réutilise `reviewNodes` déjà extrait, dernière revue par utilisateur — QO-029-02 confirmée : `latestOpinionatedReviews` suffit) et dériver `approved`/`approvedBy` de cette même liste, même principe que côté GitLab |
| Étendre `MergeRequestViewDto` | DTO | Ajouter `approvedBy!: MergeRequestUserDto[];` |
| Étendre `MergeRequestsService` | Service | Voir « Modifications sur l'existant » ci-dessous |
| Étendre `merge-requests.service.spec.ts` | Test unitaire | Mock `approversRepo` (même forme que `reviewersRepo`/`assigneesRepo`), tests d'upsert/replace/groupement/mapping |
| Étendre `merge-requests.e2e-spec.ts` | Test e2e | `RawOverrides`/`mergeRequest()` : ajouter `approvedBy?: ForgeUser[]`, `MergeRequestViewBody` : ajouter `approvedBy`. Scénarios : approuvée par 1/plusieurs personnes, non approuvée (`approvedBy: []`), approbateur retiré des reviewers après coup |
| Étendre `map-graphql-merge-request.spec.ts` | Test unitaire | Vérifie que `approvedBy` exclut l'auteur et correspond exactement aux utilisateurs comptant dans `approved` |
| Étendre `map-graphql-pull-request.spec.ts` | Test unitaire | Vérifie `approvedBy` à partir de `latestOpinionatedReviews` (état `APPROVED`, dernière revue par auteur) |

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|--------------------------|--------|-------------------|
| `merge-requests.service.ts` — constructeur | Injecter `@InjectRepository(MergeRequestApprover) private readonly approvers: Repository<MergeRequestApprover>` | Faible | Même schéma que `reviewers`/`assignees` |
| `merge-requests.service.ts` — `loadBase` | Récupérer `approverRows` en 3e requête du `Promise.all` existant (`reviewers.find`/`assignees.find`), les grouper avec `groupUserIds` (réutilisée telle quelle), inclure `...approverRows.map(r => r.userId)` dans le `userIds` distinct passé à `this.users.findByIds` | Faible | Extension directe du pattern existant, aucune requête N+1 ajoutée |
| `merge-requests.service.ts` — `toMergeRequestView` | Ajouter un paramètre `approverIds: number[]`, calculer `approvedBy = approverIds.map(id => toMergeRequestUser(mustGet(usersById, id, 'User'), identity))`, l'inclure dans le DTO retourné | Faible | Même schéma que `reviewers`/`assignees` |
| `merge-requests.service.ts` — `upsertOne` | Upserter les utilisateurs de `mergeRequest.approvedBy` (`Promise.all(...this.users.upsert...)`), puis `await this.replaceAssociations(this.approvers, saved.id, approverUsers)` | Faible | Même schéma que `reviewers`/`assignees` |
| `merge-requests.service.ts` — `replaceAssociations` | Élargir la signature `Repository<MergeRequestReviewer \| MergeRequestAssignee>` → `... \| MergeRequestApprover` | Aucun | Signature générique déjà conçue pour ça |
| `merge-requests.module.ts` | Ajouter `MergeRequestApprover` à `TypeOrmModule.forFeature` | Aucun | — |

---

## Frontend

### Intégration dans les features existantes

- Uniquement `features/board/mr-table/` (aucun autre écran concerné) : le composant table (`mr-table.component.html`)
  affiche déjà la colonne Approved (icône ✓ seule) — seule la cellule `matColumnDef="approved"` change.
- Aucune nouvelle route, aucun nouveau store : `MergeRequestsStore`/`MergeRequestsService` transmettent déjà
  `MergeRequestView` tel quel depuis l'API sans transformation par champ (vérifié : aucune référence à
  `reviewers`/`assignees`/`approved` dans `merge-requests.store.ts` ni `core/api/merge-requests.service.ts`) —
  ajouter `approvedBy` au modèle suffit, il traverse la chaîne sans code supplémentaire.

### Composants réutilisables et Angular Material

| Composant | Origine | Usage prévu |
|-----------|---------|-------------|
| `matTooltip` | Angular Material (déjà utilisé sur `reviewer`/`assignee`) | Affiche la liste des approbateurs sur la coche ✓ |
| `summarizeUsers` | `features/board/mr-table/summarize-users.ts` (déjà existant) | Réutilisé **uniquement pour son champ `.tooltip`** (`users.map(u => u.name).join(', ')`) — pas besoin de `.first`/`.extraCount`, la coche reste une icône fixe, pas un avatar |

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Étendre `MergeRequestUser`/`MergeRequestView` (`models/merge-request.model.ts`) | Interface TS | Ajouter `approvedBy: MergeRequestUser[];` à `MergeRequestView`, juste après `approved` |
| Modifier la cellule `approved` (`mr-table.component.html`, lignes 236-240) | Template | `<mat-icon svgIcon="check" class="approved-icon" [matTooltip]="summarizeUsers(row.approvedBy).tooltip" />` — quand `approvedBy` est vide (RG-029-04 : MR non resynchronisée depuis cette US), `tooltip` vaut `''` et `matTooltip` n'affiche alors rien, sans code conditionnel supplémentaire |
| Étendre `mr-table.component.spec.ts` | Test unitaire | `fixture.debugElement.query(By.css('.approved-icon')).injector.get(MatTooltip)` puis `expect(tooltip.message).toBe(...)`, même pattern que les tests de tooltip existants (ex. ligne ~167) ; couvrir : 1 approbateur, plusieurs, `approvedBy` vide (pas de tooltip visible), MR non approuvée (icône absente) |

Aucune clé i18n nouvelle (QO-029-04 tranchée : texte brut, pas de préfixe).

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|--------------------------|--------|-------------------|
| `mr-table.component.html` | Ajout d'un binding `[matTooltip]` sur `<mat-icon class="approved-icon">` | Aucun | Élément déjà présent, binding additif |
| `models/merge-request.model.ts` | Champ obligatoire ajouté à `MergeRequestView` | Faible | Toute donnée de test/fixture frontend construisant un `MergeRequestView` complet (specs des composants du tableau) devra inclure `approvedBy` — à vérifier lors du dev (grep `MergeRequestView` dans les specs) |

---

## Points de vigilance globaux

- **Cohérence `approved` / `approvedBy` (RG-029-01)** : le point le plus important de cette US est de dériver le
  booléen `approved` et la liste `approvedBy` d'une **seule et même liste filtrée**, des deux côtés (GitLab et
  GitHub), pour qu'il soit structurellement impossible que `approved = true` avec `approvedBy = []` sur une MR
  fraîchement synchronisée. Ne pas garder l'ancien calcul de `approved` (`.some(...)`) séparé d'un nouveau calcul de
  `approvedBy` : les remplacer tous les deux par la dérivation à partir de la liste commune.
- **RG-029-04 (MRs pré-US)** : ne demande aucun code défensif particulier grâce au comportement natif de
  `matTooltip` sur une chaîne vide — mais à couvrir explicitement par un test pour ne pas régresser silencieusement
  si `summarizeUsers` change un jour de comportement sur une liste vide.
- **Performance** : une 3e requête `find` (avec tri `position`) s'ajoute à `loadBase`, exécutée en parallèle des
  deux existantes (`Promise.all`) — impact négligeable, même volumétrie que reviewers/assignees.
- **Accessibilité clavier** : les cellules `reviewer`/`assignee` existantes n'ont **pas** de `tabindex` sur leur
  `<span>` porteur de `matTooltip` (vérifié dans `mr-table.component.html`) — le tooltip n'y est donc déclenché
  qu'au survol souris dans l'état actuel de l'application, pas au focus clavier, malgré le scénario Gherkin des
  specs qui mentionne l'accès clavier comme un comportement standard de `matTooltip`. **Décision** : rester
  cohérent avec le pattern existant et ne pas ajouter de `tabindex` sur `.approved-icon` dans cette US (aucune
  autre cellule du tableau ne le fait) ; le scénario clavier des specs est satisfait passivement si l'utilisateur
  atteint l'icône par tabulation via un ancêtre déjà focusable, mais aucun effort dédié n'est fait ici. Si une
  accessibilité clavier réelle est requise sur l'ensemble des tooltips du tableau, ce serait un correctif
  transverse hors périmètre de cette US.
- **GitHub — pas de test e2e dédié** : il n'existe aujourd'hui aucun `test/*.e2e-spec.ts` exerçant une
  synchronisation GitHub de bout en bout (seul GitLab est mocké dans `merge-requests.e2e-spec.ts`) — la couverture
  de `approvedBy` côté GitHub reste donc au niveau unitaire (`map-graphql-pull-request.spec.ts`), comme pour le
  reste du mapping GitHub existant.

---

## Ordre de réalisation suggéré

1. Migration TypeORM `AddMergeRequestApprovers` + entité `MergeRequestApprover` + enregistrement dans `merge-requests.module.ts`
2. `ForgeMergeRequest.approvedBy` (type commun) + mappers GitLab et GitHub (dérivation commune `approved`/`approvedBy`) + tests unitaires des mappers
3. `MergeRequestsService` : constructeur, `loadBase`, `toMergeRequestView`, `upsertOne`, `replaceAssociations` + `merge-requests.service.spec.ts`
4. `MergeRequestViewDto.approvedBy` + `merge-requests.e2e-spec.ts` (scénarios approuvée/non approuvée/approbateur retiré)
5. `models/merge-request.model.ts` (frontend) — `approvedBy` sur `MergeRequestView`
6. `mr-table.component.html` — binding `matTooltip` sur `.approved-icon` + `mr-table.component.spec.ts`
7. Validation manuelle contre le pattern visuel existant (tooltip Reviewer/Affecté) — pas de nouvelle maquette à comparer

---

## ⚠️ Points à clarifier

Aucun point bloquant. Les trois questions ouvertes techniques des specs (QO-029-01, QO-029-02, QO-029-03) sont
tranchées par cette architecture : extension du même nœud GraphQL que reviewers/assignees (QO-029-01), réutilisation
de `latestOpinionatedReviews` sans requête GraphQL supplémentaire (QO-029-02), persistance dans une table dédiée
`merge_request_approvers` par cohérence avec `merge_request_reviewers`/`merge_request_assignees` plutôt qu'un calcul
à la volée (QO-029-03, plus simple et plus rapide à lire qu'un recalcul).
