# Architecture — US-005 Tableau des MRs (colonnes de base)

## Résumé fonctionnel
Le backend expose une lecture des MRs synchronisées (7 champs, non-draft, triées par date Ready) ; le frontend
remplace le placeholder de l'écran Tableau par un vrai `mat-table` alimenté par ce contrat, rechargé à l'ouverture
et à chaque fin de synchronisation.

---

## Backend

### Impacts sur le modèle de données

Aucune migration : les tables `merge_requests`, `merge_request_reviewers`, `merge_request_assignees`, `users`,
`projects` existent déjà (US-003, US-004). Cette US n'ajoute que des DTOs et une méthode de lecture.

### Intégration dans les modules existants

- **`modules/merge-requests`** : `MergeRequestsService` (déjà porteur de `upsertForProject`/`deleteMissing`, US-004)
  reçoit une nouvelle méthode `listOpen()`. Un `MergeRequestsController` est ajouté au module (jusqu'ici sans
  controller).
- **`modules/projects`** : `ProjectsService` reçoit `findByIds(ids: number[])`, sur le modèle de `findById` (US-004)
  — utilisée pour résoudre `projectAlias` sans dépendance directe de `MergeRequestsModule` au repository `Project`.
- **`modules/users`** : `UsersService` reçoit `findByIds(ids: number[])`, même besoin pour `author`/`reviewers`/
  `assignees`.
- **`MergeRequestsModule`** importe désormais `ProjectsModule` (déjà consommateur de `UsersModule`).

Pas de nouvelle relation TypeORM (`@ManyToOne`) : conformément à l'existant (`authorId`, `projectId` restent de
simples colonnes sans relation déclarée), la résolution se fait par des requêtes `find` groupées (`In(ids)`) plutôt
que par des jointures SQL, cohérent avec le style du reste du module (`upsertForProject` fait déjà des allers-retours
similaires vers `UsersService`).

### Contrat API

| Méthode | Route | Query | Réponse | Codes |
|---------|-------|-------|---------|-------|
| GET | `/api/v1/merge-requests` | — | `MergeRequestViewDto[]` | 200 |

```ts
class MergeRequestUserDto {
  username!: string;
  name!: string;
  avatarUrl!: string | null;
}

class MergeRequestViewDto {
  id!: number;
  projectAlias!: string;
  iid!: number;
  title!: string;
  webUrl!: string;
  author!: MergeRequestUserDto;
  reviewers!: MergeRequestUserDto[];
  assignees!: MergeRequestUserDto[];
  approved!: boolean;
  commentsCount!: number;
}
```

`listOpen()` — algorithme (RG-005-01, RG-005-11) :
1. `mergeRequests.find({ where: { draft: false }, order: { readyAt: 'ASC' } })`. Tableau vide → retourner `[]`
   immédiatement (pas de requêtes supplémentaires).
2. Résoudre en une passe les ids distincts de projets (`projectId`) et d'utilisateurs (`authorId` + tous les
   `userId` des lignes `merge_request_reviewers`/`merge_request_assignees` des MRs concernées, récupérées par
   `In(mergeRequestIds)`).
3. `ProjectsService.findByIds(projectIds)` et `UsersService.findByIds(userIds)`, indexés en `Map<number, …>` par id.
4. Assembler chaque `MergeRequestViewDto` (fonction `toMergeRequestView`, au niveau fichier comme `toResponse` dans
   `projects.service.ts` — pas de règle métier à isoler en `domain/`, uniquement une reprojection de données).

`ready_at` n'est jamais renvoyé dans le DTO (RG-005-11) ; il sert uniquement à l'`order` de l'étape 1. Le filtre
`draft: false` garantit que `ready_at` n'est jamais `null` pour les lignes retournées (invariant posé par
`resolveReadyAt`, US-004) — pas de gestion de valeur nulle nécessaire pour le tri.

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Créer `dto/merge-request-user.dto.ts`, `dto/merge-request-view.dto.ts` | DTO | Réponse de `GET /merge-requests` |
| Étendre `ProjectsService.findByIds` | Service | `Repository.find({ where: { id: In(ids) } })` + test |
| Étendre `UsersService.findByIds` | Service | Idem, sur `gitlab_user_id`… non, sur `id` interne (voir Points de vigilance) + test |
| Étendre `MergeRequestsService.listOpen` | Service | Algorithme ci-dessus + fonction de mapping + tests unitaires |
| Créer `MergeRequestsController` | Controller | `GET /merge-requests` + test |
| Étendre `MergeRequestsModule` | Module | Import de `ProjectsModule`, ajout du controller |
| Créer `test/merge-requests.e2e-spec.ts` | Test e2e | Scénarios de `specs.md` §6 (peuplement direct des repositories TypeORM en base in-memory, pas de mock GitLab nécessaire) |

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|---------------------------|--------|--------------------|
| `ProjectsService` | Ajout de `findByIds` | Faible | Méthode additive, aucun changement de signature existante |
| `UsersService` | Ajout de `findByIds` | Faible | Idem |
| `MergeRequestsModule` | Ajout d'un import (`ProjectsModule`) et d'un controller | Faible | Aucune dépendance circulaire (`ProjectsModule` n'importe pas `MergeRequestsModule`) |

---

## Frontend

### Intégration dans les features existantes

- `features/board/mr-table/` (dossier déjà prévu dans `architecture-frontend.md`) accueille le nouveau composant de
  tableau.
- `stores/merge-requests.store.ts` (déjà prévu) est créé.
- `board-page.component.ts`/`.html` remplacent le `<p class="placeholder">` par `<app-mr-table>` et ses états
  associés (chargement, vide, erreur).

### Composants réutilisables et Angular Material

| Composant | Origine | Usage prévu |
|-----------|---------|-------------|
| `mat-table`, `matColumnDef`, `mat-header-row`, `mat-row` | Angular Material | Structure du tableau (sans tri/resize, US-008/US-012) |
| `mat-progress-bar mode="indeterminate"` | Angular Material | Premier chargement (RG-005-05) |
| `AvatarComponent` (`shared/avatar`, déjà construit en US-002 en prévision de cette US) | `shared/avatar` | Auteur (`variant="filled"`), reviewer/affecté (`variant="outlined"`) |
| `mat-icon svgIcon="check"` (déjà enregistrée) | `shared/icons` | Colonne Approved |
| `mat-icon svgIcon="message-square"` (déjà enregistrée) | `shared/icons` | En-tête de la colonne Commentaires |
| `matTooltip` | Angular Material | Titre complet, tooltip auteur/reviewer/affecté |
| `mat-stroked-button` | Angular Material | Bouton retry de l'état d'erreur (sur le modèle de `repositories-section`) |

Aucun nouveau composant Material requis ; aucune nouvelle icône (voir tableau ci-dessus, les deux nécessaires sont
déjà enregistrées depuis US-001/US-003).

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Créer `models/merge-request.model.ts` | Interface TS | `MergeRequestUser`, `MergeRequestView` (miroir du DTO) |
| Créer `core/api/merge-requests.service.ts` (+ spec) | Service Angular | `getMergeRequests(): Observable<MergeRequestView[]>` |
| Créer `stores/merge-requests.store.ts` (+ spec) | SignalStore | État `{ mergeRequests, loading, loadError }` (voir détail ci-dessous) |
| Créer `features/board/mr-table/summarize-users.ts` (+ spec) | Fonction pure | `{ first, extraCount, tooltip }` à partir de `reviewers`/`assignees` (RG-G06), réutilisée par les deux colonnes |
| Créer `features/board/mr-table/mr-table.component.{ts,html,scss,spec.ts}` | Composant | Tableau des 7 colonnes, purement présentationnel (`rows`, `loading`, `loadError` en `input()`, `retry` en `output()`) |
| Étendre `board-page.component.{ts,html,scss}` (+ spec) | Composant page | Injection de `MergeRequestsStore`, remplacement du placeholder, extension de l'effect de transition de synchro (RG-005-06) |
| Ajouter clés `board.mergeRequests.*` | i18n | `public/i18n/fr.json` (erreur de chargement, état vide, tooltip commentaires) |

#### `MergeRequestsStore` — détail

- État : `{ mergeRequests: MergeRequestView[]; loading: boolean; loadError: string | null }`, initial `[]`/`false`/`null`.
- `load(): Promise<void>` — sur le modèle exact de `SettingsStore.load()`/`ProjectsStore.load()` : `patchState({loading:true})`,
  puis en succès `patchState({mergeRequests, loading:false})`, en échec `patchState({loading:false, loadError: errorKeyOf(error)})`.
  **Ne réinitialise jamais `mergeRequests` à `[]` avant la réponse** (RG-005-05/07 : pas de vidage du tableau pendant
  un rechargement, ni sur erreur).

#### `board-page.component` — intégration

- Injecte `MergeRequestsStore` (`mrStore`).
- `ngOnInit` : ajoute `void this.loadMergeRequests()` (nouvelle méthode privée) aux côtés des chargements existants.
  `loadMergeRequests()` fait `await this.mrStore.load()` puis, si `this.mrStore.loadError()` est non nul, affiche le
  toast `board.mergeRequests.loadError` (RG-005-07) — décision d'implémentation : contrairement au toast de
  synchronisation (US-004), **pas de logique de "première fois"** à gérer ici, car `load()` n'est appelé qu'à des
  points de déclenchement discrets (ouverture de l'écran, fin de synchronisation) et non par un polling continu ; un
  échec au tout premier appel doit légitimement produire un toast.
- L'`effect` existant de détection de transition `SyncStore.loading(true → false)` (US-004, actuellement dédié au
  toast d'erreur de synchro) est étendu : dans la branche "transition non initiale" (celle qui gère déjà le toast
  `partial`/`error`), ajouter `void this.loadMergeRequests()`, **quel que soit le statut du run** (`success`,
  `partial` ou `error`) — RG-005-06 ne conditionne pas le rechargement au succès de la synchronisation.
- Zone de contenu (`board-content`), ordre de priorité (`noToken` inchangé, prioritaire sur tout le reste, US-004) :
  1. `noRepos()` (US-004, inchangé) → état vide "Aucun repo configuré"
  2. `mrStore.loading() && mrStore.mergeRequests().length === 0` → `mat-progress-bar`, pas de tableau (RG-005-05)
  3. `mrStore.mergeRequests().length === 0` (qu'il y ait eu une erreur ou non — voir Points de vigilance) → état vide
     "Aucune MR ouverte." (RG-005-08)
  4. sinon → `<app-mr-table [rows]="mrStore.mergeRequests()" />`

#### `MrTableComponent` — structure

- `input.required<MergeRequestView[]>('rows')`.
- Colonnes (`displayedColumns`) : `project`, `author`, `title`, `comments`, `reviewer`, `assignee`, `approved`.
- Cellule Titre : `<a [href]="row.webUrl" rel="noopener" [matTooltip]="row.title" class="title-link">{{ row.title }}</a>`,
  troncature via CSS (`text-overflow: ellipsis`).
- Cellules Reviewer/Affecté : `summarizeUsers(row.reviewers)` / `summarizeUsers(row.assignees)` → si `first` est
  `null`, afficher `—` ; sinon `<app-avatar variant="outlined" [name]="first.name" [avatarUrl]="first.avatarUrl" />`
  suivi de `+{{ extraCount }}` si `extraCount > 0`, le tout dans un conteneur portant `[matTooltip]="tooltip"` (liste
  complète des noms, RG-G06).
- Cellule Approved : `@if (row.approved) { <mat-icon svgIcon="check" class="approved" /> }`.

---

## Points de vigilance globaux

- **`UsersService.findByIds`** doit chercher sur l'id interne (`users.id`, clé primaire), pas sur `gitlab_user_id` —
  `MergeRequest.authorId` et les lignes `merge_request_reviewers`/`merge_request_assignees` référencent déjà l'id
  interne (voir `merge-requests.service.ts`, US-004). À ne pas confondre lors de l'implémentation.
- **Contenu de l'état vide en cas d'échec sans donnée préalable** : si le tout premier `GET /merge-requests` échoue
  (aucune donnée en cache), `mergeRequests` reste à `[]` et l'écran affiche le même état vide "Aucune MR ouverte."
  que s'il n'y avait légitimement aucune MR (RG-005-08) — le toast (RG-005-07) reste le seul signal de l'échec.
  Choix assumé pour ne pas introduire un quatrième état visuel absent des maquettes ; à revisiter si ce cas s'avère
  déroutant en usage réel.
- **Volume** : `listOpen()` charge la totalité des MRs ouvertes en mémoire pour construire les `Map` de résolution
  (pas de pagination, cohérent avec `architecture-backend.md` — "à revoir si > 500 MRs").
- **Aucune régression sur US-004** : le remplacement du placeholder ne touche ni au bandeau sans-jeton ni à l'état
  vide sans-repo, tous deux évalués en amont dans la même structure conditionnelle.

---

## Ordre de réalisation suggéré

1. `dto/merge-request-user.dto.ts`, `dto/merge-request-view.dto.ts`
2. `ProjectsService.findByIds`, `UsersService.findByIds` + tests unitaires
3. `MergeRequestsService.listOpen` (+ fonction de mapping) + tests unitaires
4. `MergeRequestsController` + test unitaire + `test/merge-requests.e2e-spec.ts`
5. `models/merge-request.model.ts`, `core/api/merge-requests.service.ts` + test
6. `stores/merge-requests.store.ts` + test
7. `features/board/mr-table/summarize-users.ts` + test
8. `mr-table.component` (+ i18n) + test
9. `board-page.component` (intégration, extension de l'effect existant) + test
